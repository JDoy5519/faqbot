export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supaAdmin";

const Query = z.object({
  bot_id: z.string().uuid().optional(),
});

type ViewRow = {
  id: string;
  bot_id: string;
  title: string | null;
  source_type: string | null;
  created_at: string;
  chunk_count: number;
  embedding_count: number;
  last_job_status: "queued" | "running" | "done" | "error" | null;
  last_job_type: string | null;
  last_job_created_at: string | null;
};

type FallbackDocRow = {
  id: string;
  bot_id: string;
  title: string | null;
  source_type: string | null;
  created_at: string;
  doc_chunks?: { count: number }[];
  doc_embeddings?: { count: number }[];
};

type JobsRow = {
  payload: { document_id?: string } | null;
  status: "queued" | "running" | "done" | "error";
  type: string;
  created_at: string;
};

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const parsed = Query.safeParse(Object.fromEntries(url.searchParams));
    const bot_id = parsed.success ? parsed.data.bot_id : undefined;

    // 1) Preferred: single view with counts + latest job
    try {
      let q = supabaseAdmin
  .from("v_doc_admin")
  .select(
    "id, bot_id, title, source_type, created_at, chunk_count, embedding_count, last_job_status, last_job_type, last_job_created_at"
  )
  .order("created_at", { ascending: false });


      if (bot_id) q = q.eq("bot_id", bot_id);

      const { data, error } = await q;
      if (error) throw error;

      // Cast on the way out so callers get strong types
      return NextResponse.json({
        ok: true,
        documents: (data ?? []) as unknown as ViewRow[],
      });
    } catch (e: any) {
      // If view missing, fall back; otherwise bubble error
      if (e?.code !== "42P01") {
        return NextResponse.json({ ok: false, error: e.message || String(e) }, { status: 500 });
      }
    }

    // 2) Fallback: join counts from base tables
    let q: any = supabaseAdmin
      .from("documents")
      .select(
        `
        id, bot_id, title, source_type, created_at,
        doc_chunks:doc_chunks!doc_chunks_document_id_fkey(count),
        doc_embeddings:doc_embeddings!doc_embeddings_document_id_fkey(count)
      `
      )
      .order("created_at", { ascending: false });

    if (bot_id) q = q.eq("bot_id", bot_id);

    const { data: docsRaw, error: docsErr } = await q;
    if (docsErr) throw docsErr;

    const docs: ViewRow[] = (docsRaw as FallbackDocRow[] | null)?.map((d) => ({
      id: d.id,
      bot_id: d.bot_id,
      title: d.title,
      source_type: d.source_type,
      created_at: d.created_at,
      chunk_count: d.doc_chunks?.[0]?.count ?? 0,
      embedding_count: d.doc_embeddings?.[0]?.count ?? 0,
      last_job_status: null,
      last_job_type: null,
      last_job_created_at: null,
    })) ?? [];

    // If no docs, return early
    if (docs.length === 0) {
      return NextResponse.json({ ok: true, documents: docs });
    }

    // Try to fetch latest jobs for these documents in one go
    const docIds = docs.map((d) => d.id);

    // Some PostgREST versions don’t support .in() on JSON path.
    // We’ll just pull recent jobs and reduce client-side (cheap enough for admin).
    const { data: jobsRaw, error: jobsErr } = await supabaseAdmin
      .from("jobs")
      .select("payload, status, type, created_at")
      .order("created_at", { ascending: false })
      .limit(500); // safety cap

    if (!jobsErr && jobsRaw) {
      const latestByDoc = new Map<string, JobsRow>();

      for (const j of jobsRaw as JobsRow[]) {
        const docId = j.payload?.document_id;
        if (!docId) continue;
        if (!docIds.includes(docId)) continue;
        const existing = latestByDoc.get(docId);
        if (!existing || new Date(j.created_at) > new Date(existing.created_at)) {
          latestByDoc.set(docId, j);
        }
      }

      for (const d of docs) {
        const lj = latestByDoc.get(d.id);
        if (lj) {
          d.last_job_status = lj.status;
          d.last_job_type = lj.type;
          d.last_job_created_at = lj.created_at;
        }
      }
    }

    return NextResponse.json({ ok: true, documents: docs });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "List failed" }, { status: 400 });
  }
}
