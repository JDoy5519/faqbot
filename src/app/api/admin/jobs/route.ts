import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supaAdmin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const status = u.searchParams.get("status"); // 'queued'|'running'|'done'|'error'|null
  const type = u.searchParams.get("type");     // e.g. 'embed_doc'
  const orgId = u.searchParams.get("org_id");
  const botId = u.searchParams.get("bot_id");
  const limit = Math.min(Number(u.searchParams.get("limit") ?? 100), 200);

  let q = supabaseAdmin.from("jobs").select("*").order("created_at", { ascending: false }).limit(limit);

  if (status) q = q.eq("status", status);
  if (type) q = q.eq("type", type);
  if (orgId) q = q.eq("org_id", orgId);
  if (botId) q = q.eq("bot_id", botId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, jobs: data });
}
