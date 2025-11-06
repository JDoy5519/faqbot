import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supaAdmin";

export const dynamic = "force-dynamic";

function toCSV(rows: any[]) {
  if (!rows.length) return "id,title,source_type,mimetype,created_at,org_id,bot_id\n";
  const headers = ["id","title","source_type","mimetype","created_at","org_id","bot_id"];
  const head = headers.join(",") + "\n";
  const lines = rows.map(r => headers.map(h => (r[h] ?? "")).join(",")).join("\n");
  return head + lines + "\n";
}

export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const orgId = u.searchParams.get("org_id");
  const botId = u.searchParams.get("bot_id");
  const qstr = u.searchParams.get("q"); // title filter

  if (!orgId) return new NextResponse("org_id required", { status: 400 });

  let q = supabaseAdmin.from("documents").select("id,title,source_type,mimetype,created_at,org_id,bot_id")
    .eq("org_id", orgId).order("created_at", { ascending: false });

  if (botId) q = q.eq("bot_id", botId);
  if (qstr) q = q.ilike("title", `%${qstr}%`);

  const { data, error } = await q;
  if (error) return new NextResponse(error.message, { status: 500 });

  const csv = toCSV(data ?? []);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="documents_${orgId}.csv"`
    },
  });
}
