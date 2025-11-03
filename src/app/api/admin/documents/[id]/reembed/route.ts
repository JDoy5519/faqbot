export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supaAdmin";

const Params = z.object({ id: z.string().uuid() });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = Params.parse(await ctx.params);

    // 1) Clear existing embeddings for this doc (safe even if none)
    await supabaseAdmin.from("doc_embeddings").delete().eq("document_id", id);

    // 2) Trigger your existing embedding processor for this document.
    // If your /api/admin/embeddings/process supports document_id, call it directly:
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/admin/embeddings/process`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ document_id: id }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) {
      return NextResponse.json({ ok: false, error: json?.error || "Re-embed failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Bad request" }, { status: 400 });
  }
}
