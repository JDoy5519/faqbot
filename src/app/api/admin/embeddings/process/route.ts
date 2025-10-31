// src/app/api/admin/embeddings/process/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { processEmbeddings } from "@/lib/embeddingJob";

const Body = z
  .object({
    bot_id: z.string().uuid().optional(),
    document_id: z.string().uuid().optional(),
  })
  .refine((v) => !!v.bot_id || !!v.document_id, {
    message: "Provide either bot_id or document_id",
    path: ["bot_id", "document_id"],
  })
  .refine((v) => !(v.bot_id && v.document_id), {
    message: "Provide only ONE of bot_id or document_id",
    path: ["bot_id", "document_id"],
  });

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const input = Body.parse(json);

    const res = await processEmbeddings(
      "document_id" in input && input.document_id
        ? { document_id: input.document_id }
        : { bot_id: input.bot_id! }
    );

    return NextResponse.json({ ok: true, ...res });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Unknown error" },
      { status: 400 }
    );
  }
}
