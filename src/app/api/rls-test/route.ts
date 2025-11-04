// src/app/api/rls-test/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function clientWithHeader(botToken?: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    botToken
      ? { global: { headers: { "x-bot-token": botToken } } }
      : undefined
  );
}

export async function GET(req: NextRequest) {
  const botToken = req.nextUrl.searchParams.get("bot_token") ?? undefined;

  const supaNoHeader = clientWithHeader(undefined);
  const supaWithHeader = clientWithHeader(botToken);

  const { count: countNoHeader } = await supaNoHeader
    .from("documents")
    .select("id", { count: "exact", head: true });

  const { count: countWithHeader } = await supaWithHeader
    .from("documents")
    .select("id", { count: "exact", head: true });

  return NextResponse.json({
    ok: true,
    botToken: botToken ?? null,
    countNoHeader,
    countWithHeader,
  });
}
