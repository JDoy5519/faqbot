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
import { getOrgQuota, buildQuotaHeaders } from "@/lib/quota";

// ---------------- rate limiter (simple, in-memory) ----------------
const BUCKET = new Map<string, { tokens: number; updated: number }>();
const CAP = 30;
const REFILL_MS = 60_000;
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

// ---------------- request schema (REAL mode) ----------------
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

// ---------------- helpers ----------------
function extractText(body: any): string {
  if (typeof body?.q === "string" && body.q.trim()) return body.q.trim();
  if (Array.isArray(body?.messages) && body.messages.length) {
    const lastUser = [...body.messages].reverse().find((m: any) => m?.role === "user");
    if (lastUser?.content && typeof lastUser.content === "string") return lastUser.content.trim();
  }
  return "";
}

function isTruthyEnv(name: string) {
  const v = process.env[name];
  if (!v) return false;
  const s = String(v).toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

export async function POST(req: NextRequest) {
  // Read body once (NextRequest streams are single-use)
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // ---------------- FAKE MODE SHORT-CIRCUIT ----------------
  const FAKE =
    isTruthyEnv("USE_FAKE_ANSWERS") ||
    isTruthyEnv("USE_FAKE_CHAT") ||
    isTruthyEnv("USE_FAKE_EMBEDDINGS") ||
    !process.env.OPENAI_API_KEY; // treat "no key" as fake for dev

  if (FAKE) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || (req as any)?.ip || "0.0.0.0";
    if (!take(`fake:${ip}`)) {
      return NextResponse.json(
        { ok: false, error: "Rate limit exceeded. Try again shortly." },
        { status: 429 }
      );
    }

    const text = extractText(body);
    if (!text) {
      return NextResponse.json({ ok: false, error: "Missing prompt (q or messages[0].content)" }, { status: 400 });
    }

    // Optional: echo a pseudo-citation so your UI shows sources
    const sources = [
      { tag: "S1", document_id: "demo-doc", page_start: 1, page_end: 2 },
    ];

    return NextResponse.json({
      ok: true,
      mode: "fake",
      answer: `🤖 [FAKE] You asked: "${text}". This is a stubbed response (no OpenAI call).`,
      sources,
      conversation_id: body?.conversation_id ?? null,
    });
  }
  // ---------------- END FAKE MODE ----------------

  // === REAL MODE: your existing logic, adapted to use the parsed `body` ===

  // Validate against your strict schema
  try {
    const { bot_public_token, org_id, bot_id, messages, top_k, model } = Body.parse(body);

    if (process.env.NODE_ENV !== "production") {
      // @ts-ignore
      console.log("[chat] admin key prefix =", (process.env.SUPABASE_SERVICE_ROLE_KEY || "").slice(0, 12));
      // @ts-ignore
      console.log("[chat] anon  key prefix =", (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").slice(0, 12));
    }

    console.log("[chat] SUPABASE_URL(admin) =", process.env.SUPABASE_URL);
    console.log("[chat] SUPABASE_URL(public) =", process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log("[chat] token posted =", bot_public_token);

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

      type BotRowPublic = {
        id: string;
        org_id: string;
        retrieval_k: number | null;
        max_tokens: number | null;
        cite_on: boolean | null;
        is_active: boolean | null;
        public_token: string;
        model?: string | null;
      };

      const { data: botRowRaw, error: botErr } = await supabaseAdmin
        .rpc("get_bot_by_public_token", { p_token: bot_public_token })
        .maybeSingle();

      const botRow = (botRowRaw ?? null) as BotRowPublic | null;

      if (botErr || !botRow?.id || botRow.is_active === false) {
        console.error("[chat] bot lookup failed", { botErr, token: bot_public_token });
        return NextResponse.json({ ok: false, error: "Bot not found or token invalid" }, { status: 404 });
      }

      const resolvedBotId = botRow.id;
      const resolvedOrgId = botRow.org_id;

      const supa = createPublicSupaClient(bot_public_token);

      // QUOTA
      const quota = await getOrgQuota(resolvedOrgId);
      if (quota.over) {
        return NextResponse.json(
          { ok: false, error: "Billing quota exceeded. Please upgrade your plan to continue." },
          { status: 402 }
        );
      }
      const warnHeaders = buildQuotaHeaders(quota);

      // Embed query
      const [qEmbedding] = await embedTexts([query]);

      // Vector search via RPC
      const k = Number(top_k ?? botRow.retrieval_k ?? 6);
      const searchRes = await (supa as any).rpc("search_chunks", {
        query_embedding: qEmbedding,
        q_bot_id: resolvedBotId,
        match_count: k,
      });
      if (searchRes.error) {
        return NextResponse.json({ ok: false, error: searchRes.error.message }, { status: 500 });
      }
      if (!Array.isArray(searchRes.data)) {
        console.error("[chat] search_chunks invalid shape:", searchRes.data);
        return NextResponse.json({ ok: false, error: "Vector search failed (shape)" }, { status: 500 });
      }

      type Row = {
        content?: string | null;
        document_id?: string | null;
        doc_id?: string | null;
        source_page_start?: number | null;
        source_page_end?: number | null;
        page_start?: number | null;
        page_end?: number | null;
        score?: number | null;
        similarity?: number | null;
      };

      const rows: Row[] = (searchRes.data as Row[]).filter(Boolean);
      const matches: Match[] = rows
        .map((r) => {
          const docId = r.document_id ?? r.doc_id ?? null;
          if (!docId) return null;
          return {
            content: r.content ?? "",
            document_id: docId,
            source_page_start: (r.source_page_start ?? r.page_start) ?? null,
            source_page_end: (r.source_page_end ?? r.page_end) ?? null,
            score: (r.score ?? r.similarity ?? 0) as number,
          } as Match;
        })
        .filter(Boolean) as Match[];

      const system = buildSystemPrompt();
      const user = buildUserPrompt(query, matches);
      const useModel = (typeof model === "string" && model) || (botRow.model ?? null) || "gpt-4o-mini";

      const chatRes = await chat({
        model: useModel,
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });

      const answerRaw = chatRes?.choices?.[0]?.message?.content?.trim() || "";

      const used = new Set<number>();
      const tagRegex = /\bS(\d{1,2})\b/g;
      for (const m of answerRaw.matchAll(tagRegex)) {
        const idx = Number(m[1]) - 1;
        if (idx >= 0 && idx < matches.length) used.add(idx);
      }
      if (used.size === 0 && matches.length > 0) {
        used.add(0);
        if (matches.length > 1) used.add(1);
      }
      const usedIndexes = [...used].sort((a, b) => a - b);

      const sources = usedIndexes
        .map((i) => {
          const row = matches[i];
          if (!row) return null;
          return {
            tag: `S${i + 1}`,
            document_id: row.document_id,
            page_start: row.source_page_start,
            page_end: row.source_page_end,
          };
        })
        .filter(Boolean) as Array<{
          tag: string;
          document_id: string;
          page_start: number | null;
          page_end: number | null;
        }>;

      const citeOn = !!botRow.cite_on;
      const hasSourcesLine = /\bSources:\s*\[[^\]]*\]/i.test(answerRaw);
      const answer =
        citeOn && matches.length > 0
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
      } catch {}

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
    if (!body.org_id || !body.bot_id) {
      return NextResponse.json(
        { ok: false, error: "org_id and bot_id are required in private mode" },
        { status: 400 }
      );
    }
    if (orgRow.id !== body.org_id) {
      return NextResponse.json({ ok: false, error: "API key / org_id mismatch" }, { status: 401 });
    }

    const resolvedBotIdPriv = body.bot_id;
    const resolvedOrgIdPriv = body.org_id;

    // QUOTA
    const quotaPriv = await getOrgQuota(resolvedOrgIdPriv);
    if (quotaPriv.over) {
      return NextResponse.json(
        { ok: false, error: "Billing quota exceeded. Please upgrade your plan to continue." },
        { status: 402 }
      );
    }
    const warnHeadersPriv = buildQuotaHeaders(quotaPriv);

    // Embed query
    const [qEmbeddingPriv] = await embedTexts([extractText(body) || ""]);

    // Vector search via service role
    const { data: botRowPriv, error: botErrPriv } = await supabaseAdmin
      .from("bots")
      .select("id, org_id, model, retrieval_k, max_tokens, cite_on")
      .eq("id", resolvedBotIdPriv)
      .single();
    if (botErrPriv || !botRowPriv?.id || botRowPriv.org_id !== resolvedOrgIdPriv) {
      return NextResponse.json({ ok: false, error: "Bot does not belong to org" }, { status: 403 });
    }

    const kPriv = Number(body.top_k ?? botRowPriv.retrieval_k ?? 6);
    const searchResPriv = await supabaseAdmin.rpc("search_chunks", {
      query_embedding: qEmbeddingPriv,
      q_bot_id: resolvedBotIdPriv,
      match_count: kPriv,
    });
    if (searchResPriv.error) {
      return NextResponse.json({ ok: false, error: searchResPriv.error.message }, { status: 500 });
    }
    if (!Array.isArray(searchResPriv.data)) {
      console.error("[chat] search_chunks invalid shape:", searchResPriv.data);
      return NextResponse.json({ ok: false, error: "Vector search failed (shape)" }, { status: 500 });
    }

    const rowsPriv = searchResPriv.data ?? [];
    const matchesPriv: Match[] = rowsPriv.map((r: any) => ({
      content: r.content,
      document_id: r.document_id ?? r.doc_id,
      source_page_start: r.source_page_start ?? r.page_start,
      source_page_end: r.source_page_end ?? r.page_end,
      score: r.score ?? r.similarity,
    }));

    const system = buildSystemPrompt();
    const user = buildUserPrompt(extractText(body), matchesPriv);
    const useModelPriv = body.model ?? botRowPriv.model ?? "gpt-4o-mini";

    const chatRes = await chat({
      model: useModelPriv,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const answerRaw = chatRes?.choices?.[0]?.message?.content?.trim() || "";

    const usedPriv = new Set<number>();
    const tagRegexPriv = /\bS(\d{1,2})\b/g;
    for (const m2 of answerRaw.matchAll(tagRegexPriv)) {
      const idx = Number(m2[1]) - 1;
      if (idx >= 0 && idx < matchesPriv.length) usedPriv.add(idx);
    }
    if (usedPriv.size === 0 && matchesPriv.length > 0) {
      usedPriv.add(0);
      if (matchesPriv.length > 1) usedPriv.add(1);
    }
    const usedIndexesPriv = [...usedPriv].sort((a, b) => a - b);

    const sources = usedIndexesPriv
      .map((i) => {
        const row = matchesPriv[i];
        if (!row) return null;
        return {
          tag: `S${i + 1}`,
          document_id: row.document_id,
          page_start: row.source_page_start,
          page_end: row.source_page_end,
        };
      })
      .filter(Boolean) as Array<{
        tag: string;
        document_id: string;
        page_start: number | null;
        page_end: number | null;
      }>;

    const citeOnPriv = !!botRowPriv.cite_on;
    const hasSourcesLinePriv = /\bSources:\s*\[[^\]]*\]/i.test(answerRaw);
    const answer =
      citeOnPriv && matchesPriv.length > 0
        ? (hasSourcesLinePriv ? answerRaw : `${answerRaw}\n\n${compactCitations(matchesPriv, usedIndexesPriv)}`)
        : answerRaw.replace(/\n?Sources:\s*\[[^\]]*\]\s*$/i, "").trim();

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
    } catch {}

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
      // Show readable zod errors to the client (your UI will display them properly)
      return NextResponse.json({ ok: false, error: err.issues }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: err?.message || "Bad request" }, { status: 400 });
  }
}










