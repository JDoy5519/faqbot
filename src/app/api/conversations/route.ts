export const runtime = "nodejs";
import { supaServer } from "@/lib/supaServer";
import { NextResponse } from "next/server";

export async function GET() {
  const supa = await supaServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data, error } = await supa
    .from("conversations")
    .select("id, created_at, bot_id")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, conversations: data });
}
