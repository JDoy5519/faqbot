// src/app/api/admin/settings/billing/summary/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supaAdmin";
import { ensureAdminOrThrow } from "@/lib/adminAuth";

export async function GET(_req: NextRequest) {
  // 1) Admin gate: must match ADMIN_TOKEN / admin_token cookie
  await ensureAdminOrThrow();

  // 2) Find your one-and-only org for now (FAQBot Prod)
  const { data: org, error: orgError } = await supabaseAdmin
    .from("organizations")
    .select(
      "id, name, slug, plan, billing_status, trial_ends_at, period_start, period_end, plan_id"
    )
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (orgError || !org) {
    return NextResponse.json(
      { error: "No organization found" },
      { status: 404 }
    );
  }

  // 3) Pull quota snapshot (using the org_quota_snapshot(p_org) function you migrated)
  const { data: quota, error: quotaError } = await supabaseAdmin.rpc(
    "org_quota_snapshot",
    { p_org: org.id }
  );

  if (quotaError) {
    return NextResponse.json(
      { error: quotaError.message },
      { status: 500 }
    );
  }

  // 4) Return payload the UI can use
  return NextResponse.json({
    org,
    quota,
  });
}


