export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { supaServer } from "@/lib/supaServer";

const PAGE_SIZE = 20;
const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));

export async function GET(req: NextRequest) {
  const supa = await supaServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const url = new URL(req.url);
  const page = Math.max(Number(url.searchParams.get("page") || "1"), 1);
  const q = (url.searchParams.get("q") || "").trim();
  const helpful = url.searchParams.get("helpful"); // "helpful" | "unhelpful" | null

  let includeIds: string[] | null = null;
  let excludeIds: string[] = [];

  // text search across messages → collect conversation_ids
  if (q) {
    const { data: found, error } = await supa
      .from("messages")
      .select("conversation_id")
      .ilike("content", `%${q}%`);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    includeIds = uniq((found || []).map((r: any) => r.conversation_id).filter(Boolean) as string[]);
    if (includeIds.length === 0) {
      return NextResponse.json({ ok: true, conversations: [], page, pageSize: PAGE_SIZE, total: 0 });
    }
  }

  // helpful filter
  if (helpful === "unhelpful") {
    const { data: bad, error } = await supa
      .from("messages")
      .select("conversation_id")
      .eq("helpful", false);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const badIds = uniq((bad || []).map((r: any) => r.conversation_id).filter(Boolean) as string[]);
    includeIds = includeIds ? includeIds.filter(id => badIds.includes(id)) : badIds;
    if (!includeIds || includeIds.length === 0) {
      return NextResponse.json({ ok: true, conversations: [], page, pageSize: PAGE_SIZE, total: 0 });
    }
  } else if (helpful === "helpful") {
    const { data: bad, error } = await supa
      .from("messages")
      .select("conversation_id")
      .eq("helpful", false);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    excludeIds = uniq((bad || []).map((r: any) => r.conversation_id).filter(Boolean) as string[]);
  }

  // conversations (RLS should scope by org/bot)
  let query = supa
    .from("conversations")
    .select("id, created_at, bot_id, metadata", { count: "exact" })
    .order("created_at", { ascending: false });

  if (includeIds) query = query.in("id", includeIds);

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, count, error } = await query.range(from, to);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const conversations = excludeIds.length
    ? (data || []).filter((c: any) => !excludeIds.includes(c.id))
    : (data || []);

  return NextResponse.json({
    ok: true,
    conversations,
    page,
    pageSize: PAGE_SIZE,
    total: count ?? conversations.length,
  });
}


