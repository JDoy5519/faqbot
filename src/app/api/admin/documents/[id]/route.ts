export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supaAdmin";

const Params = z.object({ id: z.string().uuid() });

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = Params.parse(await ctx.params);

    // If ON DELETE CASCADE is set, the next line is enough:
    const { error } = await supabaseAdmin.from("documents").delete().eq("id", id);

    // If you didn't set ON DELETE CASCADE, uncomment these before the document delete:
    // await supabaseAdmin.from("doc_embeddings").delete().eq("document_id", id);
    // await supabaseAdmin.from("doc_chunks").delete().eq("document_id", id);
    // const { error } = await supabaseAdmin.from("documents").delete().eq("id", id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Delete failed" }, { status: 400 });
  }
}
