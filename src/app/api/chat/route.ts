// src/app/api/chat/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { embedTexts, chat } from "@/lib/ai";
import {
  buildSystemPrompt,
  buildUserPrompt,
  compactCitations,
  type Match,
} from "@/lib/rag";
import { createPublicSupaClient } from "@/lib/supaClientPublic";
import { supabaseAdmin } from "@/lib/supaAdmin";
import { getOrgQuota, buildQuotaHeaders } from "@/lib/quota"; // <-- NEW

// ---------------- rate limiter (simple, in-memory) ----------------
const BUCKET = new Map<string, { tokens: number; updated: number }>();
const CAP = 30;           // requests per window
const REFILL_MS = 60_000; // 1 minute window
function take(key: string) {
  const now = Date.now();
  const e = BUCKET.get(key) || { tokens: CAP, updated: now };
  const elapsed = now - e.updated;
  const refill = Math.floor((elapsed / REFILL_MS) * CAP);
  if (refill > 0) {
    e.tokens = Math.min(CAP, e.tokens + refill);
    e.updated = now;
  }
  if (e.tokens <= 0) { BUCKET.set(key, e); return false; }
  e.tokens -= 1; BUCKET.set(key, e); return true;
}

// ---------------- request schema ----------------
const Body = z
  .object({
    // Public widget mode
    bot_public_token: z.string().min(8).optional(),
    // Private server-to-server mode
    org_id: z.string().uuid().optional(),
    bot_id: z.string().uuid().optional(),
    // Messages
    messages: z.array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
      })
    ),
    top_k: z.number().int().min(1).max(12).optional().default(6),
    model: z.string().optional().default("gpt-4o-mini"),
  })
  .superRefine((v, ctx) => {
    const hasPublic = !!v.bot_public_token;
    const hasPrivate = !!v.org_id && !!v.bot_id;
    if (!hasPublic && !hasPrivate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide bot_public_token OR (org_id AND bot_id)",
        path: ["bot_id"],
      });
    }
  });

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { bot_public_token, org_id, bot_id, messages, top_k, model } =
      Body.parse(json);

    // --- rate limit by IP + token/org ---
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || (req as any)?.ip || "0.0.0.0";
    const bucketKey = bot_public_token
      ? `pub:${ip}:${bot_public_token}`
      : `priv:${ip}:${org_id ?? "unknown"}`;
    if (!take(bucketKey)) {
      return NextResponse.json(
        { ok: false, error: "Rate limit exceeded. Try again shortly." },
        { status: 429 }
      );
    }

    // --- latest user message ---
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) {
      return NextResponse.json({ ok: false, error: "No user message provided" }, { status: 400 });
    }
    const query = lastUser.content.trim();
    if (!query) {
      return NextResponse.json({ ok: false, error: "Empty user message" }, { status: 400 });
    }

    // ---------------- PUBLIC MODE ----------------
    if (bot_public_token) {
      const mode: "public" = "public";
      const supa = createPublicSupaClient(bot_public_token);

      // Resolve bot + settings (RLS via public client)
      const { data: botRow, error: botErr } = await (supa as any)
        .from("bots")
        .select("id, org_id, model, retrieval_k, max_tokens, cite_on")
        .eq("public_token", bot_public_token)
        .single();
      if (botErr || !botRow?.id) {
        return NextResponse.json({ ok: false, error: "Bot not found or token invalid" }, { status: 404 });
      }

      const resolvedBotId = botRow.id as string;
      const resolvedOrgId = botRow.org_id as string;

      // ===== QUOTA GUARD (PUBLIC) =====
      const quota = await getOrgQuota(resolvedOrgId);
      if (quota.over) {
        return NextResponse.json(
          { ok: false, error: "Billing quota exceeded. Please upgrade your plan to continue." },
          { status: 402 }
        );
      }
      const warnHeaders = buildQuotaHeaders(quota);
      // =================================

      // Embed query
      const [qEmbedding] = await embedTexts([query]);

      // Vector search via RPC (RLS honored)
      const k = Number(top_k ?? botRow.retrieval_k ?? 6);
      const searchRes = await (supa as any).rpc("search_chunks", {
        query_embedding: qEmbedding,
        q_bot_id: resolvedBotId,
        match_count: k,
      });
      if (searchRes.error) {
        return NextResponse.json({ ok: false, error: searchRes.error.message }, { status: 500 });
      }

      const rows = searchRes.data ?? [];
      const matches: Match[] = rows.map((r: any) => ({
        content: r.content,
        document_id: r.document_id,
        source_page_start: r.source_page_start,
        source_page_end: r.source_page_end,
        score: r.score,
      }));

      // Build prompt and call model
      const system = buildSystemPrompt();
      const user = buildUserPrompt(query, matches);
      const useModel = model ?? botRow.model ?? "gpt-4o-mini";

      const chatRes = await chat({
        model: useModel,
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        // NOTE: your chat() type doesn't accept max_tokens, so we do not pass it.
      });

      const answerRaw = chatRes?.choices?.[0]?.message?.content?.trim() || "";

      // Figure out referenced sources
      const used = new Set<number>();
      const tagRegex = /\bS(\d{1,2})\b/g;
      for (const m of answerRaw.matchAll(tagRegex)) {
        const idx = Number(m[1]) - 1;
        if (idx >= 0 && idx < matches.length) used.add(idx);
      }
      if (used.size === 0) {
        used.add(0);
        if (matches.length > 1) used.add(1);
      }
      const usedIndexes = [...used].sort((a, b) => a - b);
      const sources = usedIndexes.map((i) => ({
        tag: `S${i + 1}`,
        document_id: matches[i].document_id,
        page_start: matches[i].source_page_start,
        page_end: matches[i].source_page_end,
      }));

      // Enforce citations based on cite_on
      const citeOn = !!botRow.cite_on;
      const hasSourcesLine = /\bSources:\s*\[[^\]]*\]/i.test(answerRaw);
      const answer = citeOn
        ? (hasSourcesLine ? answerRaw : `${answerRaw}\n\n${compactCitations(matches, usedIndexes)}`)
        : answerRaw.replace(/\n?Sources:\s*\[[^\]]*\]\s*$/i, "").trim();

      // Usage logging (best-effort)
      try {
        const realPrompt = (chatRes as any)?.usage?.prompt_tokens ?? 0;
        const realCompletion = (chatRes as any)?.usage?.completion_tokens ?? 0;
        const estPrompt = realPrompt || Math.ceil((system.length + user.length) / 4);
        const estCompletion = realCompletion || Math.ceil(answer.length / 4);

        await supabaseAdmin.from("usage_events").insert({
          org_id: resolvedOrgId,
          bot_id: resolvedBotId,
          event_type: "chat",
          prompt_tokens: estPrompt,
          completion_tokens: estCompletion,
          cost_cents: 0,
          meta: { route: "/api/chat", mode: "public" },
        });
      } catch (e) {
        console.warn("usage_events insert failed (public)", e);
      }

      // Return with quota warning header if applicable
      return new NextResponse(
        JSON.stringify({
          ok: true,
          mode,
          bot_id: resolvedBotId,
          answer,
          sources,
        }),
        { status: 200, headers: warnHeaders }
      );
    }

    // ---------------- PRIVATE MODE ----------------
    const mode: "private" = "private";

    // Bearer org_api_key required
    const auth = req.headers.get("authorization") || "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (!m) {
      return NextResponse.json(
        { ok: false, error: "Missing Authorization Bearer org_api_key" },
        { status: 401 }
      );
    }
    const presentedKey = m[1];

    // Validate org key
    const { data: orgRow, error: orgErr } = await supabaseAdmin
      .from("organizations")
      .select("id, api_key")
      .eq("api_key", presentedKey)
      .single();
    if (orgErr || !orgRow?.id) {
      return NextResponse.json({ ok: false, error: "Invalid org API key" }, { status: 401 });
    }
    if (!org_id || !bot_id) {
      return NextResponse.json(
        { ok: false, error: "org_id and bot_id are required in private mode" },
        { status: 400 }
      );
    }
    if (orgRow.id !== org_id) {
      return NextResponse.json({ ok: false, error: "API key / org_id mismatch" }, { status: 401 });
    }

    // Ensure bot belongs to org + get settings
    const { data: botRowPriv, error: botErrPriv } = await supabaseAdmin
      .from("bots")
      .select("id, org_id, model, retrieval_k, max_tokens, cite_on")
      .eq("id", bot_id)
      .single();
    if (botErrPriv || !botRowPriv?.id || botRowPriv.org_id !== org_id) {
      return NextResponse.json({ ok: false, error: "Bot does not belong to org" }, { status: 403 });
    }

    const resolvedBotIdPriv = bot_id;
    const resolvedOrgIdPriv = org_id;

    // ===== QUOTA GUARD (PRIVATE) =====
    const quotaPriv = await getOrgQuota(resolvedOrgIdPriv);
    if (quotaPriv.over) {
      return NextResponse.json(
        { ok: false, error: "Billing quota exceeded. Please upgrade your plan to continue." },
        { status: 402 }
      );
    }
    const warnHeadersPriv = buildQuotaHeaders(quotaPriv);
    // =================================

    // Embed query
    const [qEmbeddingPriv] = await embedTexts([query]);

    // Vector search via RPC (service role)
    const kPriv = Number(top_k ?? botRowPriv.retrieval_k ?? 6);
    const searchResPriv = await supabaseAdmin.rpc("search_chunks", {
      query_embedding: qEmbeddingPriv,
      q_bot_id: resolvedBotIdPriv,
      match_count: kPriv,
    });
    if (searchResPriv.error) {
      return NextResponse.json({ ok: false, error: searchResPriv.error.message }, { status: 500 });
    }

    const rowsPriv = searchResPriv.data ?? [];
    const matchesPriv: Match[] = rowsPriv.map((r: any) => ({
      content: r.content,
      document_id: r.document_id,
      source_page_start: r.source_page_start,
      source_page_end: r.source_page_end,
      score: r.score,
    }));

    // Build prompt and call model
    const system = buildSystemPrompt();
    const user = buildUserPrompt(query, matchesPriv);
    const useModelPriv = model ?? botRowPriv.model ?? "gpt-4o-mini";

    const chatRes = await chat({
      model: useModelPriv,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      // NOTE: not passing max_tokens due to your chat() type
    });

    const answerRaw = chatRes?.choices?.[0]?.message?.content?.trim() || "";

    // Pick sources referenced (fallback to top 1–2)
    const usedPriv = new Set<number>();
    const tagRegexPriv = /\bS(\d{1,2})\b/g;
    for (const m2 of answerRaw.matchAll(tagRegexPriv)) {
      const idx = Number(m2[1]) - 1;
      if (idx >= 0 && idx < matchesPriv.length) usedPriv.add(idx);
    }
    if (usedPriv.size === 0) {
      usedPriv.add(0);
      if (matchesPriv.length > 1) usedPriv.add(1);
    }
    const usedIndexesPriv = [...usedPriv].sort((a, b) => a - b);
    const sources = usedIndexesPriv.map((i) => ({
      tag: `S${i + 1}`,
      document_id: matchesPriv[i].document_id,
      page_start: matchesPriv[i].source_page_start,
      page_end: matchesPriv[i].source_page_end,
    }));

    // Enforce citations based on cite_on
    const citeOnPriv = !!botRowPriv.cite_on;
    const hasSourcesLinePriv = /\bSources:\s*\[[^\]]*\]/i.test(answerRaw);
    const answer = citeOnPriv
      ? (hasSourcesLinePriv ? answerRaw : `${answerRaw}\n\n${compactCitations(matchesPriv, usedIndexesPriv)}`)
      : answerRaw.replace(/\n?Sources:\s*\[[^\]]*\]\s*$/i, "").trim();

    // Usage logging (best-effort)
    try {
      const realPrompt = (chatRes as any)?.usage?.prompt_tokens ?? 0;
      const realCompletion = (chatRes as any)?.usage?.completion_tokens ?? 0;
      const estPrompt = realPrompt || Math.ceil((system.length + user.length) / 4);
      const estCompletion = realCompletion || Math.ceil(answer.length / 4);

      await supabaseAdmin.from("usage_events").insert({
        org_id: resolvedOrgIdPriv,
        bot_id: resolvedBotIdPriv,
        event_type: "chat",
        prompt_tokens: estPrompt,
        completion_tokens: estCompletion,
        cost_cents: 0,
        meta: { route: "/api/chat", mode: "private" },
      });
    } catch (e) {
      console.warn("usage_events insert failed (private)", e);
    }

    // Return with quota warning header if applicable
    return new NextResponse(
      JSON.stringify({
        ok: true,
        mode,
        bot_id: resolvedBotIdPriv,
        answer,
        sources,
      }),
      { status: 200, headers: warnHeadersPriv }
    );
  } catch (err: any) {
    if (err?.issues) {
      return NextResponse.json({ ok: false, error: err.issues }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: err?.message || "Bad request" }, { status: 400 });
  }
}








