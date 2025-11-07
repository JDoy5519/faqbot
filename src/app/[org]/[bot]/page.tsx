// src/app/[org]/[bot]/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { supabaseAdmin } from "@/lib/supaAdmin";
import ChatClient from "./ChatClient";

type PageProps = { params: Promise<{ org: string; bot: string }> };

export default async function HostedHelpPage({ params }: PageProps) {
  const { org, bot } = await params;

  // Resolve org + bot + public token + display prefs
  const { data: orgRow } = await supabaseAdmin
    .from("organizations")
    .select("id, name, slug")
    .eq("slug", org)
    .single();

  if (!orgRow) {
    return <main className="p-8">Unknown organization.</main>;
  }

  const { data: botRow } = await supabaseAdmin
    .from("bots")
    .select("id, name, slug, public_token, model, retrieval_k, max_tokens, cite_on")
    .eq("org_id", orgRow.id)
    .eq("slug", bot)
    .single();

  if (!botRow?.public_token) {
    return <main className="p-8">Bot not found.</main>;
  }

  // Brand + theme — you can wire this to Settings → Org later
  const brand = {
    orgName: orgRow.name ?? "Help Center",
    accent: "#3B82F6",   // matches your VLM palette choice if you want
    theme: "light" as const,
  };

  return (
    <main className="min-h-screen bg-[#F5F7FA] text-[#1F2937]">
      <header className="border-b bg-white">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">{brand.orgName}</h1>
          <div className="text-sm text-[#6B7280]">Powered by FAQBot</div>
        </div>
      </header>

      <section className="max-w-4xl mx-auto p-4">
        <div className="bg-white rounded-2xl shadow p-4 sm:p-6">
          <h2 className="text-lg font-semibold mb-2">{botRow.name ?? "Assistant"}</h2>
          <p className="text-sm text-[#6B7280] mb-4">
            Ask a question. Answers include sources when available.
          </p>
          <ChatClient
            botPublicToken={botRow.public_token}
            accent={brand.accent}
            citeOn={!!botRow.cite_on}
          />
        </div>
      </section>
    </main>
  );
}
