// src/app/admin/upload/route.ts
export const runtime = "nodejs"; // cookie setting works on Node, not Edge

import { NextRequest, NextResponse } from "next/server";
import { supaServer } from "@/lib/supaServer";
import { embedTexts } from "@/lib/ai";

function splitIntoChunks(s: string, maxLen = 800) {
  const parts: string[] = [];
  s.split(/\n{2,}/).forEach((block) => {
    const b = block.trim();
    if (!b) return;
    if (b.length <= maxLen) parts.push(b);
    else for (let i = 0; i < b.length; i += maxLen) parts.push(b.slice(i, i + maxLen));
  });
  return parts;
}

export async function POST(req: NextRequest) {
  try {
    const { botId, text } = await req.json();
    if (!botId || !text) {
      return NextResponse.json({ error: "Missing botId/text" }, { status: 400 });
    }

    // 👇 IMPORTANT: await the server client
    const supa = await supaServer();

    const {
      data: { user },
      error: userErr,
    } = await supa.auth.getUser();

    if (userErr) {
      return NextResponse.json({ error: userErr.message }, { status: 401 });
    }
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const chunks = splitIntoChunks(text);
    const vectors = await embedTexts(chunks);
    const rows = chunks.map((content, i) => ({
      bot_id: botId,
      content,
      embedding: vectors[i],
    }));

    const { error } = await supa.from("doc_chunks").insert(rows);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, inserted: rows.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "upload failed" }, { status: 500 });
  }
}


