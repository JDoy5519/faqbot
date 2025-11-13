// src/app/api/admin/bots/lookup/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supaAdmin";
import { ensureAdminOrThrow } from "@/lib/adminAuth";

async function handleLookup() {
  // Only admins should hit this
  await ensureAdminOrThrow();

  // 1) Find the first organization (for now you only have one)
  const { data: org, error: orgError } = await supabaseAdmin
    .from("organizations")
    .select("id, slug, name")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (orgError || !org) {
    return NextResponse.json(
      { error: "No organization found" },
      { status: 404 }
    );
  }

  // 2) Find the first bot for that org
  const { data: bot, error: botError } = await supabaseAdmin
    .from("bots")
    .select("id, name, public_token, slug, org_id")
    .eq("org_id", org.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (botError || !bot) {
    return NextResponse.json(
      { error: "No bot found for organization" },
      { status: 404 }
    );
  }

  // 3) Return org + bot in the shape your UI expects
  return NextResponse.json({ org, bot });
}

export async function GET(_req: NextRequest) {
  return handleLookup();
}

export async function POST(_req: NextRequest) {
  // POST just delegates to the same logic so you never get 405
  return handleLookup();
}

