// src/app/api/admin/settings/billing/summary/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supaServer } from "@/lib/supaServer";
import { supabaseAdmin } from "@/lib/supaAdmin";
import { getOrgQuota } from "@/lib/quota";

async function getOrgForUser() {
  const supa = await supaServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return null;

  const { data: join } = await supa
    .from("users_orgs")
    .select("organizations(*)")
    .eq("user_id", user.id)
    .single();

  return (join?.organizations as any) ?? null;
}

export async function GET() {
  try {
    const org = await getOrgForUser();
    if (!org?.id) {
      return NextResponse.json({ ok: false, error: "No organization found" }, { status: 401 });
    }

    // Raw quota: { used, cap, warn, over }
    const q = await getOrgQuota(org.id);

    // Normalize to UI contract
    const quota = {
      used: Number(q?.used ?? 0),
      limit: q?.cap == null ? null : Number(q.cap), // map cap -> limit
      over: Boolean(q?.over),
      period_start: null as string | null, // not provided by your helper
      period_end: null as string | null,   // not provided by your helper
      // If you later add window bounds in getOrgQuota(), map them here
    };

    // Optional org plan fields (safe fallbacks)
    const { data: orgRow } = await supabaseAdmin
      .from("organizations")
      .select("id, name, plan_name, plan_status, trial_ends_at")
      .eq("id", org.id)
      .maybeSingle();

    const planName = orgRow?.plan_name ?? "Free";
    const planStatus = (orgRow?.plan_status as string) ?? (quota.over ? "past_due" : "active");
    const trialEndsAt = orgRow?.trial_ends_at ?? null;

    return NextResponse.json({
      ok: true,
      org_id: org.id,
      plan: {
        name: planName,
        status: planStatus,
        trial_ends_at: trialEndsAt,
      },
      quota,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}

