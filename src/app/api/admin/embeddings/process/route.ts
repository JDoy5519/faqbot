// src/app/api/admin/embeddings/process/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { ensureAdminOrThrow } from "@/lib/adminAuth";

const Body = z.object({
  document_id: z.string().uuid(),
  bot_id: z.string().uuid().optional(),
  org_id: z.string().uuid().optional(),
  type: z.enum(["embed_document", "reembed_document"]).default("reembed_document"),
});

export async function POST(req: Request) {
  try {
    // 1) Auth (cookie or x-admin-token header)
    await ensureAdminOrThrow();

    // 2) Parse body safely → 400 on bad JSON/shape
    const json = await req.json().catch(() => null);
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid request body", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { document_id, bot_id: bodyBotId, org_id: bodyOrgId, type } = parsed.data;

    // 3) Env
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      return NextResponse.json(
        { ok: false, error: "Server misconfig: missing SUPABASE envs" },
        { status: 500 }
      );
    }
    const supa = createClient(url, serviceKey);

    // 4) Fetch document (to derive & validate org/bot)
    const { data: doc, error: docErr } = await supa
      .from("documents")
      .select("id, org_id, bot_id")
      .eq("id", document_id)
      .single();

    if (docErr || !doc) {
      return NextResponse.json({ ok: false, error: "Document not found" }, { status: 404 });
    }

    // 5) Resolve final org_id / bot_id
    //    Preference: document values (if present), else request body values
    const finalOrgId = doc.org_id ?? bodyOrgId ?? null;
    const finalBotId = doc.bot_id ?? bodyBotId ?? null;

    // If document already has org_id/bot_id and caller provided different ones → conflict
    if (doc.org_id && bodyOrgId && bodyOrgId !== doc.org_id) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "org_id conflict: document already has an org_id that differs from the request body.",
        },
        { status: 409 }
      );
    }
    if (doc.bot_id && bodyBotId && bodyBotId !== doc.bot_id) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "bot_id conflict: document already has a bot_id that differs from the request body.",
        },
        { status: 409 }
      );
    }

    // If still missing, fail fast with a helpful message
    if (!finalOrgId || !finalBotId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Missing org_id and/or bot_id. Backfill the document row or pass org_id/bot_id in the request body.",
        },
        { status: 400 }
      );
    }

    // 6) Insert job (enqueue) with guaranteed non-null org/bot
    const { error: insertErr } = await supa.from("jobs").insert({
      type,
      payload: { document_id },
      org_id: finalOrgId,
      bot_id: finalBotId,
      status: "queued",
    });

    if (insertErr) {
      return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, queued: true });
  } catch (e: any) {
    console.error("[/api/admin/embeddings/process] enqueue failed:", e);
    return NextResponse.json(
      { ok: false, error: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}




