import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supaAdmin";

export const dynamic = "force-dynamic";

type Payload = {
  action: "reembed" | "delete";
  ids: string[];
  org_id: string;
  bot_id?: string | null;
};

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Payload;
  if (!body.org_id || !Array.isArray(body.ids) || !body.ids.length)
    return NextResponse.json({ ok: false, error: "org_id and ids required" }, { status: 400 });

  // Safety: scope to org
  const { data: docs, error } = await supabaseAdmin.from("documents")
    .select("id, org_id, bot_id")
    .in("id", body.ids).eq("org_id", body.org_id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  if (body.action === "delete") {
    const { error: delErr } = await supabaseAdmin.from("documents")
      .delete().in("id", docs!.map(d => d.id)).eq("org_id", body.org_id);
    if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, deleted: docs!.length });
  }

  if (body.action === "reembed") {
    // Enqueue one job per doc (you already have Day 12 worker queue)
    const jobs = docs!.map(d => ({
      org_id: d.org_id,
      bot_id: d.bot_id,
      type: "embed_doc",
      status: "queued",
      payload: { document_id: d.id },
    }));
    const { error: insErr } = await supabaseAdmin.from("jobs").insert(jobs);
    if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, queued: docs!.length });
  }

  return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
}
