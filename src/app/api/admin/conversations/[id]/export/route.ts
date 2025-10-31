export const runtime = "nodejs";
import { NextRequest } from "next/server";
import { supaServer } from "@/lib/supaServer";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const supa = await supaServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return new Response("Not authenticated", { status: 401 });

  const { id: rawId } = await ctx.params;
  const convoId = Array.isArray(rawId) ? rawId[0] : rawId;

  const { data: conv } = await supa
    .from("conversations")
    .select("id, created_at, bot_id, metadata")
    .eq("id", convoId)
    .single();

  const { data: msgs } = await supa
    .from("messages")
    .select("id, role, content, created_at, helpful, feedback_note")
    .eq("conversation_id", convoId)
    .order("created_at", { ascending: true });

  const blob = JSON.stringify({ conversation: conv, messages: msgs || [] }, null, 2);
  return new Response(blob, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="conversation-${convoId}.json"`,
    },
  });
}


