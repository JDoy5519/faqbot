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
import { supabaseAdmin } from "@/lib/supaAdmin"; // service-role client

// Accept EITHER:
//  A) Public widget:   { bot_public_token, messages, top_k?, model? }
//  B) Server-to-server:{ org_id, bot_id, messages, top_k?, model? } + Bearer org_api_key
const Body = z
  .object({
    bot_public_token: z.string().min(8).optional(), // public path
    org_id: z.string().uuid().optional(),           // private path
    bot_id: z.string().uuid().optional(),           // private path
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

    // 1) Latest user message
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser)
      return NextResponse.json({ ok: false, error: "No user message provided" }, { status: 400 });
    const query = lastUser.content.trim();
    if (!query)
      return NextResponse.json({ ok: false, error: "Empty user message" }, { status: 400 });

    // 2) Resolve operating mode + bot_id + org_id
    let resolvedBotId: string;
    let resolvedOrgId: string;
    let mode: "public" | "private";

    if (bot_public_token) {
      // PUBLIC mode — RLS enforced by x-bot-token
      mode = "public";
      const supa = createPublicSupaClient(bot_public_token);

      // Need id + org_id here so we can log usage against the org
      const { data: botRow, error: botErr } = await (supa as any)
        .from("bots")
        .select("id, org_id")
        .eq("public_token", bot_public_token)
        .single();

      if (botErr || !botRow?.id) {
        return NextResponse.json({ ok: false, error: "Bot not found or token invalid" }, { status: 404 });
      }
      resolvedBotId = botRow.id as string;
      resolvedOrgId  = botRow.org_id as string;

      // 3) Embed the user question
      const [qEmbedding] = await embedTexts([query]);

      // 4) Vector search via RPC (RLS enforced by public client)
      const searchRes = await (supa as any).rpc("search_chunks", {
        query_embedding: qEmbedding,
        q_bot_id: resolvedBotId,
        match_count: top_k,
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

      // 5) Build prompts and call model
      const system = buildSystemPrompt();
      const user = buildUserPrompt(query, matches);
      const chatRes = await chat({
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });

      const answer = chatRes.choices?.[0]?.message?.content?.trim() || "";

      // 6) Pick sources referenced (fallback to top 1–2)
      const used = new Set<number>();
      const tagRegex = /\bS(\d{1,2})\b/g;
      for (const m of answer.matchAll(tagRegex)) {
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

      const hasSourcesLine = /\bSources:\s*\[.*\]/i.test(answer);
      const finalAnswer = hasSourcesLine ? answer : `${answer}\n\n${compactCitations(matches, usedIndexes)}`;

      // 7) USAGE LOGGING (public) — best-effort, never blocks the response
      try {
        // Prefer real usage if your chat() helper returns counts
        const realPrompt = (chatRes as any)?.usage?.prompt_tokens ?? 0;
        const realCompletion = (chatRes as any)?.usage?.completion_tokens ?? 0;

        const estimatedPrompt =
          realPrompt ||
          Math.ceil((system.length + user.length) / 4); // very rough 4 chars/token estimate
        const estimatedCompletion =
          realCompletion || Math.ceil(answer.length / 4);

        const prompt_tokens = estimatedPrompt;
        const completion_tokens = estimatedCompletion;
        const cost_cents = 0; // plug real costing later

        await supabaseAdmin.from("usage_events").insert({
          org_id: resolvedOrgId,
          bot_id: resolvedBotId,
          event_type: "chat",
          prompt_tokens,
          completion_tokens,
          cost_cents,
          meta: { route: "/api/chat", mode: "public" },
        });
      } catch (e) {
        console.warn("usage_events insert failed (public)", e);
      }

      return NextResponse.json({
        ok: true,
        mode,
        bot_id: resolvedBotId,
        answer: finalAnswer,
        sources,
      });
    }

    // PRIVATE mode — requires Authorization: Bearer ORG_API_KEY
    mode = "private";

    // Verify Authorization header
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

    // Ensure bot belongs to org
    const { data: botRowPriv, error: botErrPriv } = await supabaseAdmin
      .from("bots")
      .select("id, org_id")
      .eq("id", bot_id)
      .single();

    if (botErrPriv || !botRowPriv?.id || botRowPriv.org_id !== org_id) {
      return NextResponse.json({ ok: false, error: "Bot does not belong to org" }, { status: 403 });
    }

    const resolvedBotIdPriv = bot_id;
    const resolvedOrgIdPriv = org_id;

    // 3) Embed the user question
    const [qEmbedding] = await embedTexts([query]);

    // 4) Vector search (service role)
    const searchResPriv = await supabaseAdmin.rpc("search_chunks", {
      query_embedding: qEmbedding,
      q_bot_id: resolvedBotIdPriv,
      match_count: top_k,
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

    // 5) Build prompts and call model
    const system = buildSystemPrompt();
    const user = buildUserPrompt(query, matchesPriv);
    const chatRes = await chat({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const answer = chatRes.choices?.[0]?.message?.content?.trim() || "";

    // 6) Pick sources referenced (fallback to top 1–2)
    const used = new Set<number>();
    const tagRegex = /\bS(\d{1,2})\b/g;
    for (const m2 of answer.matchAll(tagRegex)) {
      const idx = Number(m2[1]) - 1;
      if (idx >= 0 && idx < matchesPriv.length) used.add(idx);
    }
    if (used.size === 0) {
      used.add(0);
      if (matchesPriv.length > 1) used.add(1);
    }
    const usedIndexes = [...used].sort((a, b) => a - b);
    const sources = usedIndexes.map((i) => ({
      tag: `S${i + 1}`,
      document_id: matchesPriv[i].document_id,
      page_start: matchesPriv[i].source_page_start,
      page_end: matchesPriv[i].source_page_end,
    }));

    const hasSourcesLine = /\bSources:\s*\[.*\]/i.test(answer);
    const finalAnswer = hasSourcesLine ? answer : `${answer}\n\n${compactCitations(matchesPriv, usedIndexes)}`;

    // 7) USAGE LOGGING (private) — best-effort
    try {
      const realPrompt = (chatRes as any)?.usage?.prompt_tokens ?? 0;
      const realCompletion = (chatRes as any)?.usage?.completion_tokens ?? 0;

      const estimatedPrompt =
        realPrompt || Math.ceil((system.length + user.length) / 4);
      const estimatedCompletion =
        realCompletion || Math.ceil(answer.length / 4);

      const prompt_tokens = estimatedPrompt;
      const completion_tokens = estimatedCompletion;
      const cost_cents = 0; // add costing later

      await supabaseAdmin.from("usage_events").insert({
        org_id: resolvedOrgIdPriv,
        bot_id: resolvedBotIdPriv,
        event_type: "chat",
        prompt_tokens,
        completion_tokens,
        cost_cents,
        meta: { route: "/api/chat", mode: "private" },
      });
    } catch (e) {
      console.warn("usage_events insert failed (private)", e);
    }

    return NextResponse.json({
      ok: true,
      mode,
      bot_id: resolvedBotIdPriv,
      answer: finalAnswer,
      sources,
    });
  } catch (err: any) {
    if (err?.issues) {
      return NextResponse.json({ ok: false, error: err.issues }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: err?.message || "Bad request" }, { status: 400 });
  }
}






