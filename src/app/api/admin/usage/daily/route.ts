import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supaAdmin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const orgId = u.searchParams.get("org_id");
  const botId = u.searchParams.get("bot_id");
  const from = u.searchParams.get("from"); // 'YYYY-MM-DD'
  const to = u.searchParams.get("to");     // 'YYYY-MM-DD'

  if (!orgId) return NextResponse.json({ ok: false, error: "org_id required" }, { status: 400 });

  let q = supabaseAdmin.from("v_usage_daily").select("*").eq("org_id", orgId).order("day", { ascending: true });
  if (botId) q = q.eq("bot_id", botId);
  if (from) q = q.gte("day", from);
  if (to) q = q.lte("day", to);

  const { data, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, rows: data });
}
