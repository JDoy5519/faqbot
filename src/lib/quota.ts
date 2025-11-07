import { supabaseAdmin } from "@/lib/supaAdmin";

/**
 * Returns the current month's usage snapshot for an org.
 * - used: number of tokens used in the current billing window
 * - cap: plan cap (defaults to 50_000 if no plan)
 * - warn: true if >=80% of cap
 * - over: true if > cap
 */
export async function getOrgQuota(orgId: string) {
  // 1) Get plan for this org
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("id, plan_id")
    .eq("id", orgId)
    .single();

  // default tiny free trial cap
  let cap = 50_000;
  if (org?.plan_id) {
    const { data: plan } = await supabaseAdmin
      .from("plans")
      .select("monthly_token_cap")
      .eq("id", org.plan_id)
      .single();
    if (plan?.monthly_token_cap) cap = plan.monthly_token_cap;
  }

  // 2) Current period usage via your RPC
  const { data: snap } = await supabaseAdmin.rpc("org_quota_snapshot", { p_org: orgId } as any);
  const used = Number(snap?.used || 0);

  // 3) Flags
  const warn = used >= Math.floor(0.8 * cap);
  const over = used > cap;

  return { used, cap, warn, over };
}

/** Build response headers to surface a client warning toast */
export function buildQuotaHeaders(q: { used: number; cap: number; warn: boolean }) {
  const headers = new Headers();
  if (q.warn) headers.set("x-quota-warning", `80% used (${q.used}/${q.cap})`);
  return headers;
}
