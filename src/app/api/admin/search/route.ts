// src/app/api/admin/search/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supaAdmin";
import { embedTexts } from "@/lib/ai"; // <-- uses USE_FAKE_EMBEDDINGS if set

const Body = z.object({
  q: z.string().min(1),
  bot_id: z.string().uuid(),
  top_k: z.number().int().min(1).max(25).optional().default(8),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { q, bot_id, top_k } = Body.parse(json);

    // 1) Embed the query (fake or real, depending on env)
    const [queryEmbedding] = await embedTexts([q]);

    // 2) ANN search via SQL function
    const { data, error } = await supabaseAdmin.rpc("search_chunks", {
      query_embedding: queryEmbedding,
      q_bot_id: bot_id,
      match_count: top_k,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      matches: (data ?? []).map((r: any) => ({
        chunk_id: r.chunk_id,
        document_id: r.document_id,
        source_page_start: r.source_page_start,
        source_page_end: r.source_page_end,
        content: r.content,
        score: r.score,
      })),
    });
  } catch (err: any) {
    // Always return JSON, never HTML
    const msg = err?.message || "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}



