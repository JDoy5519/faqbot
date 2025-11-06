import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supaAdmin";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const orgId = u.searchParams.get("org_id");
  if (!orgId) return NextResponse.json({ ok: false, error: "org_id required" }, { status: 400 });
  const { data, error } = await supabaseAdmin.from("organizations").select("*").eq("id", orgId).single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, org: data });
}

export async function POST(req: NextRequest) {
  const { org_id, name, slug, webhook_url, rotate_api_key } = await req.json();
  if (!org_id) return NextResponse.json({ ok: false, error: "org_id required" }, { status: 400 });

  let update: any = { name, slug, webhook_url };
  if (rotate_api_key) {
    // prefix helps future key introspection
    const newKey = "org_" + randomBytes(24).toString("hex");
    update.api_key = newKey;
  }

  const { data, error } = await supabaseAdmin
    .from("organizations")
    .update(update)
    .eq("id", org_id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, org: data });
}
