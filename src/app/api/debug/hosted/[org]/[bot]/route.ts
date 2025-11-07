// src/app/api/debug/hosted/[org]/[bot]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supaAdmin";

type Ctx = { params: Promise<{ org: string; bot: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { org, bot } = await ctx.params;

  // 1) What env is the server using?
  const env = {
    SUPABASE_URL: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "(missing)",
    KEY_KIND:
      process.env.SUPABASE_SERVICE_ROLE_KEY ? "service-role" :
      process.env.SUPABASE_ANON_KEY ? "anon" :
      "(no key found)",
  };

  // 2) Resolve org by slug
  const { data: orgRow, error: orgErr } = await supabaseAdmin
    .from("organizations")
    .select("id, name, slug, api_key")
    .eq("slug", org)
    .single();

  // 3) Resolve bot by slug + org_id
  let botRow: any = null, botErr: any = null, botCandidates: any[] = [];
  if (orgRow?.id) {
    const res = await supabaseAdmin
      .from("bots")
      .select("id, name, slug, org_id, public_token, retrieval_k, max_tokens, cite_on")
      .eq("org_id", orgRow.id)
      .eq("slug", bot)
      .maybeSingle();
    botRow = res.data; botErr = res.error;

    // For extra clarity: how many bots match just the slug, or just the org?
    const [bySlug, byOrg] = await Promise.all([
      supabaseAdmin.from("bots").select("id, org_id, slug, public_token").eq("slug", bot),
      supabaseAdmin.from("bots").select("id, org_id, slug, public_token").eq("org_id", orgRow.id),
    ]);
    botCandidates = [
      { note: "bots matching slug", count: bySlug.data?.length ?? 0, rows: bySlug.data ?? [] },
      { note: "bots in org",        count: byOrg.data?.length ?? 0,  rows: byOrg.data ?? [] },
    ];
  }

  return NextResponse.json({
    ok: true,
    params: { org, bot },
    env,
    org: { row: orgRow, error: orgErr?.message },
    bot: {
      row: botRow,
      error: botErr?.message,
      candidates: botCandidates,
    },
  });
}
