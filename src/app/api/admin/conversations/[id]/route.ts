// src/app/api/admin/conversations/[id]/route.ts

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { supaServer } from "@/lib/supaServer";



type ConvById = {

  id?: string;

  conversation_id?: string;

  created_at?: string;

  bot_id?: string | null;

  metadata?: any;

};



export async function GET(

  _req: NextRequest,

  ctx: { params: Promise<{ id: string }> } // Next 16: params is a Promise

) {

  const supa = await supaServer();

  const { data: { user } } = await supa.auth.getUser();

  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });



  const { id: rawId } = await ctx.params; // ✅ unwrap the Promise

  const triedId = Array.isArray(rawId) ? rawId[0] : rawId;



  // Try PK: id

  const resA = await supa

    .from("conversations")

    .select("id, created_at, bot_id, metadata")

    .eq("id", triedId)

    .maybeSingle();



  let conv: ConvById | null = (resA.data as any) ?? null;

  let lookupUsed: "id" | "conversation_id" | "none" = conv ? "id" : "none";

  let convErr = resA.error || null;



  // Fallback: PK: conversation_id

  if (!conv) {

    const resB = await supa

      .from("conversations")

      .select("conversation_id, created_at, bot_id, metadata")

      .eq("conversation_id", triedId)

      .maybeSingle();

    if (resB.data) {

      conv = resB.data as any;

      lookupUsed = "conversation_id";

      convErr = resB.error || null;

    }

  }



  if (!conv) {

    return NextResponse.json(

      { ok: false, error: convErr?.message || "Not found", debug: { triedId, lookupUsed } },

      { status: 404 }

    );

  }



  const fkValue = (conv.id || conv.conversation_id) as string;



  const { data: msgs, error: mErr } = await supa

    .from("messages")

    .select("id, role, content, created_at, helpful, feedback_note")

    .eq("conversation_id", fkValue)

    .order("created_at", { ascending: true });



  if (mErr) {

    return NextResponse.json({ ok: false, error: mErr.message, stage: "messages", debug: { fkValue } }, { status: 400 });

  }



  const normalized = {

    id: conv.id || conv.conversation_id,

    created_at: conv.created_at,

    bot_id: conv.bot_id ?? null,

    metadata: conv.metadata ?? {},

  };



  return NextResponse.json({ ok: true, conversation: normalized, messages: msgs || [] });

}


