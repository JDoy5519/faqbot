export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supaAdmin";
import pdfParse from "pdf-parse";
import { buildChunksFromPages, normalizeText } from "@/lib/chunker";
import { createHash } from "crypto";

// add to the DocRow type:
type DocRow = {
  id: string;
  name: string | null;
  storage_path: string;
  mimetype: string | null;
  bot_id: string; // <-- add this (assume NOT NULL if your schema enforces it)
};

export async function POST(req: NextRequest) {
  try {
    const { document_id } = await req.json();
    if (!document_id) {
      return NextResponse.json({ error: "Missing document_id" }, { status: 400 });
    }

    const { data: doc, error: docErr } = await supabaseAdmin
  .from("documents")
  .select("id, name, storage_path, mimetype, bot_id") // <-- add bot_id
  .eq("id", document_id)
  .maybeSingle();
  

    if (docErr) return NextResponse.json({ error: docErr.message }, { status: 500 });
    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    // Basic guard
    if (doc.mimetype && doc.mimetype !== "application/pdf") {
      return NextResponse.json({ error: `Unsupported mimetype: ${doc.mimetype}` }, { status: 415 });
    }

    // 2) Download from storage
    const key = doc.storage_path.replace(/^docs\//, "");
    const { data: fileData, error: dlErr } = await supabaseAdmin.storage.from("docs").download(key);
    if (dlErr || !fileData) {
      return NextResponse.json({ error: `Download failed: ${dlErr?.message ?? "unknown"}` }, { status: 500 });
    }

    const buf = Buffer.from(await fileData.arrayBuffer());

    // 3) Extract per-page text (using pdf-parse).
    // We'll collect page strings ourselves via a small pagerender hook.
    // If pagerender fails for any reason, we fallback to the combined text.
    let pages: { page: number; text: string }[] = [];
    let pageCounter = 0;

    const parsed = await pdfParse(buf, {
      pagerender: async (pageData: any) => {
        const tc = await pageData.getTextContent();
        const s = tc.items.map((i: any) => ("str" in i ? i.str : "")).join(" ");
        pageCounter += 1;
        const cleaned = normalizeText(s);
        pages.push({ page: pageCounter, text: cleaned });
        return cleaned; // also returned to pdf-parse's .text if needed
      },
    });

    if (!pages.length) {
      // Fallback: single "page" = whole text
      const whole = normalizeText(parsed.text || "");
      if (whole.length === 0) {
        return NextResponse.json({ error: "No text extracted from PDF" }, { status: 422 });
      }
      pages = [{ page: 1, text: whole }];
    }

    // 4) Build token-aware chunks
    const chunks = buildChunksFromPages(pages, { minTokens: 800, maxTokens: 1200 });

    // Dedupe (code-level) first by hash within this batch
    const seen = new Set<string>();
    const uniqueChunks = chunks.filter((c) => {
      if (seen.has(c.hash)) return false;
      seen.add(c.hash);
      return true;
    });

    // 5) Determine starting chunk_index for this document
    const { data: existingCountData, error: countErr } = await supabaseAdmin
      .from("doc_chunks")
      .select("id", { count: "exact", head: true })
      .eq("document_id", doc.id);

    if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });
    const startIndex = (existingCountData as unknown as { count: number } | null)?.count ?? 0;

    // 6) Insert in batches (ON CONFLICT DO NOTHING via unique index)
    // Supabase insert ignores conflicts only if policy allowed; unique index will block dup rows anyway.
    const rows = uniqueChunks.map((c, i) => ({
      document_id: doc.id,
  bot_id: doc.bot_id,                // <-- add this
  chunk_index: startIndex + i,
  content: c.content,
  token_count: c.token_count,
  source_page_start: c.source_page_start,
  source_page_end: c.source_page_end,
  hash: c.hash,
    }));

    // Insert in chunks to avoid payload limits (e.g., 100 at a time)
    const batchSize = 100;
    for (let i = 0; i < rows.length; i += batchSize) {
      const slice = rows.slice(i, i + batchSize);
      const { error: insErr } = await supabaseAdmin.from("doc_chunks").insert(slice);
      if (insErr) {
        // If you expect duplicates across runs, you can catch insErr.code === '23505' (unique_violation) and continue
        // For Day 7, surface the first error plainly:
        return NextResponse.json({ error: `Insert failed: ${insErr.message}` }, { status: 500 });
      }
    }

    return NextResponse.json({
      ok: true,
      document_id: doc.id,
      chunks_inserted: rows.length,
      pages_detected: pages.length,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
