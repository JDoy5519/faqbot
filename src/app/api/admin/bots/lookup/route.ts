// src/app/api/admin/bots/lookup/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supaAdmin";

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  const { data, error, status } = await supabaseAdmin
    .from("bots")
    .select("id, org_id, public_token")
    .eq("public_token", token)
    .maybeSingle();
  return NextResponse.json({ status, data, error });
}
