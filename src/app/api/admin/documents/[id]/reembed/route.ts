// src/app/api/admin/documents/[id]/reembed/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supaAdmin";
import { ensureAdminOrThrow } from "@/lib/adminAuth";

const Params = z.object({ id: z.string().uuid() });

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await ensureAdminOrThrow(); // cookie OR x-admin-token OR Bearer ADMIN_TOKEN

    // Next.js 16 params are a Promise
    const { id: document_id } = Params.parse(await ctx.params);

    // 0) Get org_id & bot_id for the document (so Jobs can filter properly)
    const { data: doc, error: eDoc } = await supabaseAdmin
      .from("documents")
      .select("id, org_id, bot_id")
      .eq("id", document_id)
      .single();

    if (eDoc || !doc) {
      return NextResponse.json({ ok: false, error: "Document not found" }, { status: 404 });
    }

    // 1) Clear existing embeddings for this doc (safe even if none)
    const { error: eDel } = await supabaseAdmin
      .from("doc_embeddings")
      .delete()
      .eq("document_id", document_id);
    if (eDel) {
      return NextResponse.json({ ok: false, error: eDel.message }, { status: 500 });
    }

    // 2) Directly enqueue a job (no inner fetch, no header forwarding needed)
    const payload = { document_id };
    const { data: job, error: eJob } = await supabaseAdmin
      .from("jobs")
      .insert({
        type: "embed_doc",
        status: "queued",
        org_id: doc.org_id,
        bot_id: doc.bot_id,
        payload,
      })
      .select("id")
      .single();

    if (eJob || !job) {
      return NextResponse.json({ ok: false, error: eJob?.message || "Queue insert failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, queued: 1, job_id: job.id });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Bad request" },
      { status: (err as any)?.status || 400 }
    );
  }
}

