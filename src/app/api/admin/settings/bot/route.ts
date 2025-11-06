import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supaAdmin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const botId = u.searchParams.get("bot_id");
  if (!botId) return NextResponse.json({ ok: false, error: "bot_id required" }, { status: 400 });
  const { data, error } = await supabaseAdmin.from("bots").select("*").eq("id", botId).single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, bot: data });
}

export async function POST(req: NextRequest) {
  const { bot_id, name, model, retrieval_k, max_tokens, cite_on } = await req.json();
  if (!bot_id) return NextResponse.json({ ok: false, error: "bot_id required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("bots")
    .update({ name, model, retrieval_k, max_tokens, cite_on })
    .eq("id", bot_id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, bot: data });
}
