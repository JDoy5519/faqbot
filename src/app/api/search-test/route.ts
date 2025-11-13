import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supaAdmin";
import { embedTexts } from "@/lib/ai";

export async function GET() {
  // Health check
  return Response.json({ ok: true, health: "search-test alive" });
}

export async function POST(req: NextRequest) {
  const { botId, question } = await req.json();
  if (!botId || !question) {
    return Response.json({ error: "Missing botId/question" }, { status: 400 });
  }

  // Make one 1536-d embedding (real or fake, depending on your env)
  const [qvec] = await embedTexts([question]);

  const { data, error } = await supabaseAdmin.rpc("match_doc_chunks", {
    p_bot_id: botId,
    p_query_embedding: qvec,
    p_match_count: 5
  });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ matches: data ?? [] });
}