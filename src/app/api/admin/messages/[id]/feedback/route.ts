export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { supaServer } from "@/lib/supaServer";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const supa = await supaServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let payload: any = {};
  const ctype = req.headers.get("content-type") || "";
  if (ctype.includes("application/json")) {
    payload = await req.json();
  } else {
    const fd = await req.formData();
    payload.helpful = fd.get("helpful");
    payload.note = fd.get("note");
  }

  const { id: rawId } = await ctx.params;
  const messageId = Array.isArray(rawId) ? rawId[0] : rawId;
  const helpful = typeof payload.helpful === "string" ? payload.helpful === "true" : !!payload.helpful;
  const note = payload.note ?? null;

  const { error } = await supa
    .from("messages")
    .update({ helpful, feedback_note: note })
    .eq("id", messageId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}


