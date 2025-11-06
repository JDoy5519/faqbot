import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supaAdmin";
import { chunkText } from "@/lib/chunk";
import { embedTexts } from "@/lib/ai";

export async function POST(req: NextRequest) {
  const { orgId, botId, title = "FAQ", rawText } = await req.json();

  if (!orgId || !botId || !rawText) {
    return Response.json({ error: "Missing orgId/botId/rawText" }, { status: 400 });
  }

  // 1) Insert document record
  const { data: doc, error: e1 } = await supabaseAdmin
    .from("documents")
    .insert({
      org_id: orgId,
      bot_id: botId,
      title,
      source_type: "manual",
      raw_text: rawText,
    })
    .select()
    .single();

  if (e1 || !doc)
    return Response.json(
      { error: e1?.message ?? "Document insert failed" },
      { status: 500 },
    );

  // 2) Chunk text
  const chunks = chunkText(rawText, 800);
  if (!chunks.length)
    return Response.json({ error: "No chunks produced" }, { status: 400 });

  // 3) Embed text chunks (returns 1536-dim vectors)
  const vectors = await embedTexts(chunks);
  if (vectors.length !== chunks.length)
    return Response.json(
      { error: "Embedding count mismatch" },
      { status: 500 },
    );

  // 4) Insert chunk rows with embeddings
  const rows = chunks.map((content, i) => ({
    doc_id: doc.id,
    bot_id: botId,
    content,
    embedding: vectors[i] as unknown as any,
  }));

  const { error: e2 } = await supabaseAdmin.from("doc_chunks").insert(rows);
  if (e2) return Response.json({ error: e2.message }, { status: 500 });

  // 5) Optional usage logging (counts + cost)
  try {
    const tokensUsed = chunks.join(" ").split(/\s+/).length * 1.5; // crude estimate
    const costUSD = (tokensUsed / 1000) * 0.0001; // adjust per your embedding model cost
    const costCents = Math.round(costUSD * 100);

    await supabaseAdmin.from("usage_events").insert({
      org_id: orgId,
      bot_id: botId,
      event_type: "embed",
      prompt_tokens: Math.round(tokensUsed),
      completion_tokens: 0,
      cost_cents: costCents,
      meta: { route: "/api/ingest", chunks: chunks.length },
    });
  } catch (err) {
    console.warn("usage_events insert failed", err);
  }

  return Response.json({ ok: true, chunks: rows.length, docId: doc.id });
}
