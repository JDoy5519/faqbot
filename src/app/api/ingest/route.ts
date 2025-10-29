import { NextRequest } from "next/server";
import { supaAdmin } from "@/lib/supaAdmin";
import { chunkText } from "@/lib/chunk";
import { embedTexts } from "@/lib/ai";

export async function POST(req: NextRequest) {
  const { orgId, botId, title = "FAQ", rawText } = await req.json();

  if (!orgId || !botId || !rawText) {
    return Response.json({ error: "Missing orgId/botId/rawText" }, { status: 400 });
  }

  // 1) Insert the document
  const { data: doc, error: e1 } = await supaAdmin
    .from("documents")
    .insert({
      org_id: orgId,
      bot_id: botId,
      title,
      source_type: "manual",
      raw_text: rawText
    })
    .select()
    .single();

  if (e1 || !doc) return Response.json({ error: e1?.message ?? "doc insert failed" }, { status: 500 });

  // 2) Chunk
  const chunks = chunkText(rawText, 800);
  if (!chunks.length) return Response.json({ error: "No chunks produced" }, { status: 400 });

  // 3) Embed (returns 1536-length vectors)
  const vectors = await embedTexts(chunks);
  if (vectors.length !== chunks.length) {
    return Response.json({ error: "Embedding count mismatch" }, { status: 500 });
  }

  // 4) Insert vectors
  const rows = chunks.map((content, i) => ({
    doc_id: doc.id,
    bot_id: botId,
    content,
    embedding: vectors[i] as unknown as any
  }));

  const { error: e2 } = await supaAdmin.from("doc_chunks").insert(rows);
  if (e2) return Response.json({ error: e2.message }, { status: 500 });

  // 5) Usage log (optional)
  await supaAdmin.from("usage_events").insert({
    org_id: orgId,
    bot_id: botId,
    kind: "embedding",
    qty: rows.length
  });

  return Response.json({ ok: true, chunks: rows.length, docId: doc.id });
}
