// src/app/api/chat/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supaAdmin";
import { embedTexts, chat } from "@/lib/ai";
import { buildSystemPrompt, buildUserPrompt, compactCitations, type Match } from "@/lib/rag";

const Body = z.object({
  bot_id: z.string().uuid(),
  messages: z.array(z.object({ role: z.enum(["user", "assistant", "system"]), content: z.string() })),
  top_k: z.number().int().min(1).max(12).optional().default(6),
  model: z.string().optional().default("gpt-4o-mini"),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { bot_id, messages, top_k, model } = Body.parse(json);

    // 1) Build a search query from the latest user message
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) {
      return NextResponse.json({ ok: false, error: "No user message provided" }, { status: 400 });
    }
    const query = lastUser.content.trim();
    if (!query) {
      return NextResponse.json({ ok: false, error: "Empty user message" }, { status: 400 });
    }

    // 2) Embed the query and run ANN search
    const [qEmbedding] = await embedTexts([query]);
    const { data, error } = await supabaseAdmin.rpc("search_chunks", {
      query_embedding: qEmbedding,
      q_bot_id: bot_id,
      match_count: top_k,
    });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const matches: Match[] =
      (data ?? []).map((r: any) => ({
        content: r.content,
        document_id: r.document_id,
        source_page_start: r.source_page_start,
        source_page_end: r.source_page_end,
        score: r.score,
      })) ?? [];

    // 3) Compose prompts
    const system = buildSystemPrompt();
    const user = buildUserPrompt(query, matches);

    // 4) Call the chat model
    const chatRes = await chat({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    

    const answer = chatRes.choices[0]?.message?.content?.trim() || "";

    // 5) Heuristic: mark sources referenced (S1, S2...) if the assistant mentions them
    // If not, include top 2 by score.
    const used = new Set<number>();
    const tagRegex = /\bS(\d{1,2})\b/g;
    for (const m of answer.matchAll(tagRegex)) {
      const idx = Number(m[1]) - 1;
      if (idx >= 0 && idx < matches.length) used.add(idx);
    }
    if (used.size === 0) {
      // take top 2
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

    // 6) Append compact citations if missing
    const hasSourcesLine = /\bSources:\s*\[.*\]/i.test(answer);
    const finalAnswer = hasSourcesLine
      ? answer
      : `${answer}\n\n${compactCitations(matches, usedIndexes)}`;

    return NextResponse.json({
      ok: true,
      answer: finalAnswer,
      sources,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Bad request" }, { status: 400 });
  }
}


