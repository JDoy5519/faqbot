// src/app/api/chat/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { embedTexts, chat } from "@/lib/ai"; // uses your existing chat()
import {
  buildSystemPrompt,
  buildUserPrompt,
  compactCitations,
  type Match,
} from "@/lib/rag";
import { createPublicSupaClient } from "@/lib/supaClientPublic"; // <-- NEW (public client w/ x-bot-token)

// ───────────────────────────────────────────────────────────────────────────────
// Request schema: use bot_public_token (uuid) for public, RLS-safe retrieval.
// ───────────────────────────────────────────────────────────────────────────────
const Body = z.object({
  bot_public_token: z.string().uuid(),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string(),
    })
  ),
  top_k: z.number().int().min(1).max(12).optional().default(6),
  model: z.string().optional().default("gpt-4o-mini"),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { bot_public_token, messages, top_k, model } = Body.parse(json);

    // ───────────────────────────────────────────────────────────────────────────
    // 1) Extract the user's latest message and validate
    // ───────────────────────────────────────────────────────────────────────────
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser)
      return NextResponse.json(
        { ok: false, error: "No user message provided" },
        { status: 400 }
      );

    const query = lastUser.content.trim();
    if (!query)
      return NextResponse.json(
        { ok: false, error: "Empty user message" },
        { status: 400 }
      );

    // ───────────────────────────────────────────────────────────────────────────
    // 2) Public Supabase client with x-bot-token header
    //    This enforces RLS: only rows tied to this bot's token are visible.
    // ───────────────────────────────────────────────────────────────────────────
    const supa = createPublicSupaClient(bot_public_token);

    // ───────────────────────────────────────────────────────────────────────────
    // 3) Resolve the bot_id from the public token (RLS allows this row)
    // ───────────────────────────────────────────────────────────────────────────
    const { data: botRow, error: botErr } = await supa
      .from("bots")
      .select("id")
      .eq("public_token", bot_public_token)
      .single();

    if (botErr || !botRow?.id) {
      return NextResponse.json(
        { ok: false, error: "Bot not found or token invalid" },
        { status: 404 }
      );
    }

    const bot_id: string = botRow.id;

    // ───────────────────────────────────────────────────────────────────────────
    // 4) Embed the user question (server-side; not affected by RLS)
    // ───────────────────────────────────────────────────────────────────────────
    const [qEmbedding] = await embedTexts([query]);

    // ───────────────────────────────────────────────────────────────────────────
    // 5) Vector search via your existing RPC (RLS will filter by x-bot-token)
    //    NOTE: RPC expects (query_embedding, q_bot_id, match_count)
    // ───────────────────────────────────────────────────────────────────────────
    const { data, error } = await supa.rpc("search_chunks", {
      query_embedding: qEmbedding,
      q_bot_id: bot_id,
      match_count: top_k,
    });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    const matches: Match[] =
      (data ?? []).map((r: any) => ({
        content: r.content,
        document_id: r.document_id,
        source_page_start: r.source_page_start,
        source_page_end: r.source_page_end,
        score: r.score,
      })) ?? [];

    // ───────────────────────────────────────────────────────────────────────────
    // 6) Build prompts and call the chat model (your existing helper)
    // ───────────────────────────────────────────────────────────────────────────
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

    // ───────────────────────────────────────────────────────────────────────────
    // 7) Pick the sources actually referenced (fallback to top 1–2)
    // ───────────────────────────────────────────────────────────────────────────
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
    const finalAnswer = hasSourcesLine
      ? answer
      : `${answer}\n\n${compactCitations(matches, usedIndexes)}`;

    return NextResponse.json({ ok: true, answer: finalAnswer, sources });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Bad request" },
      { status: 400 }
    );
  }
}




