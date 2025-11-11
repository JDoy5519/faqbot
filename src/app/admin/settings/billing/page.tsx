"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type BillingSummary = {
  ok: boolean;
  error?: string;
  org_id?: string;
  plan?: {
    name: string;
    status: string;
    trial_ends_at?: string | null;
  };
  quota?: {
    used: number;
    limit: number | null;
    over: boolean;
    period_start?: string | null;
    period_end?: string | null;
  };
};

export default function BillingPage() {
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(false);

  // --- Load billing summary ---
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/settings/billing/summary", { cache: "no-store" });
        const json: BillingSummary = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
        setSummary(json);
      } catch (e: any) {
        toast.error(e?.message || "Failed to load billing");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // --- Derived values ---
  const plan = summary?.plan?.name ?? "Free";
  const status = summary?.plan?.status ?? "active";
  const trialEnd = summary?.plan?.trial_ends_at
    ? new Date(summary.plan.trial_ends_at).toLocaleDateString()
    : null;

  const used = summary?.quota?.used ?? 0;
  const limit = summary?.quota?.limit ?? 0;
  const pct = useMemo(() => {
    if (!limit) return 0;
    return Math.min(100, Math.round((used / limit) * 100));
  }, [used, limit]);

  // --- Handlers ---
  async function openCheckout() {
    try {
      setLoading(true);
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.url) throw new Error(j?.error || "Checkout failed");
      window.location.href = j.url;
    } catch (e: any) {
      toast.error(e?.message || "Upgrade failed");
    } finally {
      setLoading(false);
    }
  }

  async function openPortal() {
    try {
      setLoading(true);
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.url) throw new Error(j?.error || "Portal failed");
      window.location.href = j.url;
    } catch (e: any) {
      toast.error(e?.message || "Portal failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Billing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Plan Info */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm text-gray-600">Current plan</div>
              <div className="text-base font-medium">
                {plan} <span className="text-gray-500 font-normal">— {status}</span>
              </div>
              {trialEnd && (
                <div className="text-xs text-gray-500">Trial ends: {trialEnd}</div>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={openCheckout} disabled={loading}>
                Upgrade Plan
              </Button>
              <Button variant="outline" onClick={openPortal} disabled={loading}>
                Manage in Stripe
              </Button>
            </div>
          </div>

          {/* Usage */}
          <div>
            <div className="flex items-end justify-between mb-1">
              <div className="text-sm text-gray-600">Monthly usage</div>
              <div className="text-xs text-gray-500">
                {limit ? `${used} / ${limit}` : `${used}`}
              </div>
            </div>
            <div className="h-2 w-full rounded bg-gray-100">
              <div
                className={`h-2 rounded ${
                  pct >= 90
                    ? "bg-red-500"
                    : pct >= 75
                    ? "bg-yellow-500"
                    : "bg-blue-500"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {summary?.quota?.over ? (
              <div className="mt-2 text-xs text-red-600">
                You’ve exceeded your plan’s monthly limit. Upgrade to continue.
              </div>
            ) : pct >= 80 ? (
              <div className="mt-2 text-xs text-yellow-700">
                You’re over 80% of your limit — consider upgrading.
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}


