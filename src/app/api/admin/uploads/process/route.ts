// src/app/api/admin/uploads/process/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supaAdmin";
import pdfParse from "pdf-parse";
import { buildChunksFromPages, normalizeText } from "@/lib/chunker";
import { processEmbeddings } from "@/lib/embeddingJob";

// Optional: type for clarity (matches your documents schema)
type DocRow = {
  id: string;
  name: string | null;
  storage_path: string;
  mimetype: string | null;
  bot_id: string; // required by your flow
};

export async function POST(req: NextRequest) {
  try {
    const { document_id } = await req.json();
    if (!document_id) {
      return NextResponse.json({ error: "Missing document_id" }, { status: 400 });
    }

    // 1) Fetch document (include bot_id)
    const { data: doc, error: docErr } = await supabaseAdmin
      .from("documents")
      .select("id, name, storage_path, mimetype, bot_id")
      .eq("id", document_id)
      .maybeSingle<DocRow>();

    if (docErr) return NextResponse.json({ error: docErr.message }, { status: 500 });
    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    // Guard for now: only PDFs
    if (doc.mimetype && doc.mimetype !== "application/pdf") {
      return NextResponse.json(
        { error: `Unsupported mimetype: ${doc.mimetype}` },
        { status: 415 }
      );
    }

    // 2) Download file from Storage
    // If you store as "docs/<key>", strip the "docs/" prefix for .download()
    const key = doc.storage_path.replace(/^docs\//, "");
    const { data: fileData, error: dlErr } = await supabaseAdmin.storage
      .from("docs")
      .download(key);

    if (dlErr || !fileData) {
      return NextResponse.json(
        { error: `Download failed: ${dlErr?.message ?? "unknown"}` },
        { status: 500 }
      );
    }

    const buf = Buffer.from(await fileData.arrayBuffer());

    // 3) Parse PDF -> page texts (try pagerender; fallback to combined)
    let pages: { page: number; text: string }[] = [];
    let pageCounter = 0;

    const parsed = await pdfParse(buf, {
      pagerender: async (pageData: any) => {
        const tc = await pageData.getTextContent();
        const s = tc.items.map((i: any) => ("str" in i ? i.str : "")).join(" ");
        pageCounter += 1;
        const cleaned = normalizeText(s);
        pages.push({ page: pageCounter, text: cleaned });
        return cleaned;
      },
    });

    if (!pages.length) {
      const whole = normalizeText(parsed.text || "");
      if (whole.length === 0) {
        return NextResponse.json({ error: "No text extracted from PDF" }, { status: 422 });
      }
      pages = [{ page: 1, text: whole }];
    }

    // 4) Token-aware chunking
    const chunks = buildChunksFromPages(pages, { minTokens: 800, maxTokens: 1200 });

    // Dedupe within this batch by hash
    const seen = new Set<string>();
    const uniqueChunks = chunks.filter((c) => {
      if (seen.has(c.hash)) return false;
      seen.add(c.hash);
      return true;
    });

    // 5) Determine starting chunk_index for this document
    const { count: existingCount, error: countErr } = await supabaseAdmin
      .from("doc_chunks")
      .select("*", { count: "exact", head: true })
      .eq("document_id", doc.id);

    if (countErr) {
      return NextResponse.json({ error: countErr.message }, { status: 500 });
    }
    const startIndex = existingCount ?? 0;

    // 6) Prepare rows for insert
    const rows = uniqueChunks.map((c, i) => ({
      document_id: doc.id,
      bot_id: doc.bot_id,
      chunk_index: startIndex + i,
      content: c.content,
      token_count: c.token_count,
      source_page_start: c.source_page_start,
      source_page_end: c.source_page_end,
      hash: c.hash,
    }));

    // 7) Insert in batches to avoid payload limits
    const batchSize = 100;
    for (let i = 0; i < rows.length; i += batchSize) {
      const slice = rows.slice(i, i + batchSize);
      const { error: insErr } = await supabaseAdmin.from("doc_chunks").insert(slice);
      if (insErr) {
        // If duplicates may occur (unique_violation 23505), you can ignore and continue.
        // For now, surface the first error to make issues clear during Day 8.
        return NextResponse.json({ error: `Insert failed: ${insErr.message}` }, { status: 500 });
      }
    }

    // 8) Kick off embeddings for this document (server-side, fire-and-forget)
    // Use document scope so we only embed the newly added chunks.
    void processEmbeddings({ document_id: doc.id });

    return NextResponse.json({
      ok: true,
      document_id: doc.id,
      bot_id: doc.bot_id,
      pages_detected: pages.length,
      chunks_inserted: rows.length,
      embeddings_triggered: true,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}

