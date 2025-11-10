// src/app/admin/settings/billing/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { supabaseAdmin } from "@/lib/supaAdmin";
import { redirect } from "next/navigation";

export default async function BillingPage() {
  // Replace with your real "current org" resolution
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("id, name, plan_id, stripe_customer_id")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  const { data: snap } = org
    ? await supabaseAdmin.rpc("org_quota_snapshot", { p_org: org.id } as any)
    : { data: null };

  async function actionCheckout(formData: FormData): Promise<void> {
    "use server";
    const price_id = String(formData.get("price_id") || "");
    const base = process.env.NEXT_PUBLIC_BASE_URL || "";
    const res = await fetch(`${base}/api/billing/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ org_id: org?.id, price_id }),
      cache: "no-store",
    });
    const j = await res.json();
    if (j.url) redirect(j.url); // <-- navigate here
    // else do nothing (stays on page)
  }

  async function actionPortal(): Promise<void> {
    "use server";
    const base = process.env.NEXT_PUBLIC_BASE_URL || "";
    const res = await fetch(`${base}/api/billing/portal`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ org_id: org?.id }),
      cache: "no-store",
    });
    const j = await res.json();
    if (j.url) redirect(j.url); // <-- navigate here
  }

  return (
    <main className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold mb-2">Billing</h1>
      <p className="text-sm text-gray-500 mb-6">Manage your plan and see usage.</p>

      <div className="rounded-2xl border bg-white p-4 mb-6">
        <div className="text-sm">Plan: <b>{org?.plan_id || "Free"}</b></div>
        <div className="text-sm">
          Usage: <b>{snap?.used ?? 0}</b> / <b>{snap?.cap ?? 0}</b> tokens ({snap?.pct ?? 0}%)
        </div>
      </div>

      <form action={actionCheckout} className="flex gap-2 mb-4">
        <select name="price_id" className="border rounded px-2 py-1 text-sm" defaultValue={process.env.STRIPE_PRICE_FAQ_STARTER}>
          <option value={process.env.STRIPE_PRICE_FAQ_STARTER}>Starter (£19/mo)</option>
          <option value={process.env.STRIPE_PRICE_FAQ_PRO}>Pro (£99/mo)</option>
        </select>
        <button className="rounded bg-black text-white px-3 py-1 text-sm" type="submit">
          Subscribe / Change plan
        </button>
      </form>

      <form action={actionPortal}>
        <button className="rounded border px-3 py-1 text-sm" type="submit">
          Open customer portal
        </button>
      </form>
    </main>
  );
}

