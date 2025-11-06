import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supaAdmin";

export const dynamic = "force-dynamic";

function toCSV(rows: any[]) {
  if (!rows.length) return "org_id,bot_id,day,prompt_tokens,completion_tokens,total_tokens,cost_cents\n";
  const headers = Object.keys(rows[0]);
  const head = headers.join(",") + "\n";
  const lines = rows.map(r => headers.map(h => r[h] ?? "").join(",")).join("\n");
  return head + lines + "\n";
}

export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const orgId = u.searchParams.get("org_id");
  const botId = u.searchParams.get("bot_id");
  const from = u.searchParams.get("from");
  const to = u.searchParams.get("to");
  if (!orgId) return new NextResponse("org_id required", { status: 400 });

  let q = supabaseAdmin.from("v_usage_daily").select("*").eq("org_id", orgId).order("day", { ascending: true });
  if (botId) q = q.eq("bot_id", botId);
  if (from) q = q.gte("day", from);
  if (to) q = q.lte("day", to);

  const { data, error } = await q;
  if (error) return new NextResponse(error.message, { status: 500 });

  const csv = toCSV(data ?? []);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="usage_${orgId}.csv"`
    },
  });
}
