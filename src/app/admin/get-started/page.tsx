// src/app/admin/get-started/page.tsx
import Link from "next/link";
import { supaServer } from "@/lib/supaServer";

export const dynamic = "force-dynamic";

// Narrow type for what we read from organizations
type Org = {
  id: string;
  has_uploaded: boolean | null;
  has_embeddings: boolean | null;
  has_chatted: boolean | null;
  billing_status: string | null; // 'trial' | 'active' | etc.
};

function asOrg(x: unknown): Org | null {
  if (!x) return null;
  const o = Array.isArray(x) ? x[0] : x;
  return (o as Org) ?? null;
}

async function getOrgForUser(): Promise<Org | null> {
  const supabase = await supaServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Ask for explicit columns to keep the payload lean and predictable
  const { data: join, error } = await supabase
    .from("users_orgs")
    .select(
      "organizations(id, has_uploaded, has_embeddings, has_chatted, billing_status)"
    )
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (error) return null;

  return asOrg((join as any)?.organizations);
}

export default async function GetStartedPage() {
  const org = await getOrgForUser();

  const steps = [
    { key: "has_uploaded" as const, label: "Upload your first PDF", href: "/admin/upload" },
    { key: "has_embeddings" as const, label: "Process embeddings", href: "/admin/jobs" },
    { key: "has_chatted" as const, label: "Ask a question in Chat", href: "/admin/chat" },
    { key: "billing" as const, label: "Activate billing", href: "/admin/settings/billing" },
  ];

  return (
    <div className="max-w-2xl">
      <h1 className="mb-2 text-2xl font-semibold">Get Started</h1>
      <p className="mb-6 text-sm text-gray-600">
        Follow these steps to set up your workspace.
      </p>

      <ol className="space-y-3">
        {steps.map((s) => {
          const done =
            s.key === "billing"
              ? org?.billing_status === "active"
              : Boolean(org?.[s.key as keyof Org]);
          return (
            <li
              key={s.key}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <div>
                <div className="text-sm font-medium">{s.label}</div>
                <div className="text-xs text-gray-500">
                  {done ? "Completed" : "Pending"}
                </div>
              </div>
              <Link
                href={s.href}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                {done ? "Review" : "Do this"}
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

