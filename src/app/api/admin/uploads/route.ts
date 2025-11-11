// src/app/api/admin/uploads/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supaAdmin";

const MAX_BYTES = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = new Set(["application/pdf"]);

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-()+\s]/g, "_");
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    // Accept either "file" or "files"
    const single = form.get("file");
    const multiple = form.getAll("files");
    const files: File[] = [];
    if (single instanceof File) files.push(single);
    for (const f of multiple) if (f instanceof File) files.push(f);

    const botId = (form.get("bot_id") as string) || "";
    if (!files.length) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    }
    if (!botId) {
      return NextResponse.json({ error: "bot_id required" }, { status: 400 });
    }

    // 🔎 Look up bot → organization_id
    const { data: bot, error: botErr } = await supabaseAdmin
      .from("bots")
      .select("id, org_id")
      .eq("id", botId)
      .single();

    if (botErr || !bot?.org_id) {
      return NextResponse.json(
        { error: `Bot not found or missing organization_id for bot_id=${botId}` },
        { status: 400 }
      );
    }
    const orgId = bot.org_id as string;

    const results: Array<{
      document_id: string;
      job_id: string | null;
      name: string;
      publicUrl: string | null;
      size: number;
      mimetype: string;
    }> = [];

    for (const f of files) {
      // Validate
      if (!ALLOWED_TYPES.has(f.type)) {
        return NextResponse.json(
          { error: `Only PDFs are allowed. Got: ${f.type || "unknown"}` },
          { status: 415 }
        );
      }
      if (f.size > MAX_BYTES) {
        return NextResponse.json(
          { error: `File too large. Max is ${Math.round(MAX_BYTES / (1024 * 1024))}MB` },
          { status: 413 }
        );
      }

      // IDs/paths
      const documentId = crypto.randomUUID();
      const safeName = sanitizeFileName(f.name || "document.pdf");
      const storagePath = `docs/${botId}/${documentId}_${safeName}`;

      // Upload to storage bucket "docs"
      const { error: upErr } = await supabaseAdmin.storage
        .from("docs")
        .upload(storagePath.replace(/^docs\//, ""), f, {
          contentType: f.type,
          upsert: false,
        });

      if (upErr) {
        return NextResponse.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 });
      }

      // Insert document row (include bot + org)
      const { error: insErr } = await supabaseAdmin.from("documents").insert({
        id: documentId,
        name: f.name,
        size: f.size,
        mimetype: f.type,
        storage_path: storagePath,
        bot_id: botId,
        org_id: orgId, // or org_id if that’s your column
      });

      if (insErr) {
        return NextResponse.json({ error: `DB insert failed: ${insErr.message}` }, { status: 500 });
      }

      // Create an embedding job, queued, carrying org + bot in payload
      const { data: job, error: jobErr } = await supabaseAdmin
        .from("jobs")
        .insert({
          type: "embed",
          state: "queued",
          document_id: documentId,
          bot_id: botId,
          org_id: orgId,
          progress_percent: 0,
          payload: { bot_id: botId, storage_path: storagePath, org_id: orgId },
        })
        .select("id")
        .single();

      if (jobErr) {
        return NextResponse.json(
          { error: `Job insert failed: ${jobErr.message}` },
          { status: 500 }
        );
      }

      // Public URL (if bucket public)
      const { data: pub } = supabaseAdmin
        .storage
        .from("docs")
        .getPublicUrl(storagePath.replace(/^docs\//, ""));
      const publicUrl = pub?.publicUrl ?? null;

      results.push({
        document_id: documentId,
        job_id: job.id,
        name: f.name,
        publicUrl,
        size: f.size,
        mimetype: f.type,
      });
    }

    const first = results[0] ?? null;
    return NextResponse.json({
      ok: true,
      files: results,
      // canonical
      document_id: first?.document_id ?? null,
      job_id: first?.job_id ?? null,
      // aliases
      id: first?.document_id ?? null,
      jobId: first?.job_id ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
