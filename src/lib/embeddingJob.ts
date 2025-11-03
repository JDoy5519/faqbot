// src/lib/embeddingJob.ts
import { supabaseAdmin } from "@/lib/supaAdmin";
import { embedTexts } from "@/lib/ai";

// Reasonable safety guard against absurd inputs (we already chunk earlier)
const MAX_CHARS_PER_TEXT = 7500;
const BATCH_SIZE = 100 as const;

export type EmbedJobInput =
  | { document_id: string; bot_id?: never }
  | { bot_id: string; document_id?: never };

type ChunkRow = {
  id: string;
  bot_id: string;
  document_id: string;
  content: string;
  source_page_start: number | null;
  source_page_end: number | null;
};

export async function processEmbeddings(input: EmbedJobInput) {
  // 1) Find chunks that do NOT yet have an embedding
  const filters =
    "document_id" in input
      ? { key: "document_id", val: input.document_id }
      : { key: "bot_id", val: input.bot_id };

  // Left join to find "missing in embeddings"
  const { data: rows, error } = await supabaseAdmin.rpc("exec_sql", {
    // Small RPC helper: we'll create exec_sql below if you don't already have it.
    // If you *don't* want exec_sql, see the alternative query below.
    sql: `
      select
        c.id,
        c.bot_id,
        c.document_id,
        c.content,
        c.source_page_start,
        c.source_page_end
      from public.doc_chunks c
      left join public.doc_embeddings e
        on e.chunk_id = c.id
      where e.id is null
        and c.${filters.key} = '${filters.val}'
      order by c.created_at asc
      limit 5000;
    `,
  });

  if (error) {
    // Fallback: do the same with a standard query if you don't have exec_sql
    const fallback = await supabaseAdmin
      .from("doc_chunks")
      .select("id, bot_id, document_id, content, source_page_start, source_page_end")
      .order("created_at", { ascending: true })
      .limit(5000);

    if (fallback.error) throw fallback.error;

    // Filter out ones that already have embeddings
    const ids = fallback.data.map((r) => r.id);
    const { data: already, error: alreadyErr } = await supabaseAdmin
      .from("doc_embeddings")
      .select("chunk_id")
      .in("chunk_id", ids);

    if (alreadyErr) throw alreadyErr;
    const embedded = new Set((already ?? []).map((x) => x.chunk_id));
    const pending = (fallback.data as ChunkRow[]).filter((r) => !embedded.has(r.id));
    return await embedInsertBatches(pending);
  }

  return await embedInsertBatches((rows ?? []) as ChunkRow[]);
}

async function embedInsertBatches(chunks: ChunkRow[]) {
  if (!chunks.length) {
    return { processed: 0, inserted: 0, skipped: 0 };
  }

  let processed = 0;
  let inserted = 0;
  let skipped = 0;

  // Batch by BATCH_SIZE
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);

    // Prepare inputs; skip giant texts (shouldn't happen with your chunker)
    const inputs = batch.map((b) => {
      let t = b.content ?? "";
      if (t.length > MAX_CHARS_PER_TEXT) {
        t = t.slice(0, MAX_CHARS_PER_TEXT);
      }
      return t;
    });

    // If all were too short/empty, skip
    const allEmpty = inputs.every((t) => t.trim().length === 0);
    if (allEmpty) {
      skipped += batch.length;
      processed += batch.length;
      continue;
    }

    // Backoff wrapper in case OpenAI rate limits
    const embeddings = await withBackoff(() => embedTexts(inputs));

    // Prepare rows for insert
    const rows = batch.map((b, idx) => ({
      bot_id: b.bot_id,
      document_id: b.document_id,
      chunk_id: b.id,
      embedding: embeddings[idx] ?? embeddings[0], // defensive
    }));

    const { error: insertErr } = await supabaseAdmin
      .from("doc_embeddings")
      .insert(rows);

    if (insertErr) {
      // Partial failure path — insert one by one
      for (let j = 0; j < rows.length; j++) {
        const r = rows[j];

        const { error: singleErr } = await supabaseAdmin
          .from("doc_embeddings")
          .insert([r]);

        if (singleErr) {
          if (String(singleErr.message).toLowerCase().includes("duplicate")) {
            skipped += 1; // someone else inserted it; safe to skip
          } else {
            skipped += 1; // log in real worker; skip here
          }
        } else {
          inserted += 1;
        }
      }
    } else {
      // Batch insert succeeded
      inserted += batch.length;
    }

    processed += batch.length;
  }

  return { processed, inserted, skipped };
}

// Simple exponential backoff helper for transient errors
async function withBackoff<T>(fn: () => Promise<T>, tries = 5): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const delay = 250 * Math.pow(2, i); // 250ms, 500ms, 1s, 2s, 4s...
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
