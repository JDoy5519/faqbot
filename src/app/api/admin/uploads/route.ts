import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supaAdmin";

const MAX_BYTES = 50 * 1024 * 1024; // 50MB per file for Day 6
const ALLOWED_TYPES = new Set(["application/pdf"]);

function sanitizeFileName(name: string) {
  // keep it simple/safe for S3 paths
  return name.replace(/[^\w.\-()+\s]/g, "_");
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    // Support multiple files: <input name="files" multiple />
    const files = form.getAll("files");
    const botId = (form.get("bot_id") as string) || null;

    if (!files.length) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    }

    const results: Array<{
      id: string;
      name: string;
      publicUrl: string | null;
      size: number;
      mimetype: string;
    }> = [];

    for (const f of files) {
      if (!(f instanceof File)) {
        return NextResponse.json({ error: "Invalid file field" }, { status: 400 });
      }

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

      // Storage path: docs/<bot|unscoped>/<uuid>_<safeName>
      const id = crypto.randomUUID();
      const safeName = sanitizeFileName(f.name || "document.pdf");
      const folder = botId ? botId : "unscoped";
      const storagePath = `docs/${folder}/${id}_${safeName}`;

      // Upload to Supabase storage — Blob streams fine (no base64).
      const { error: upErr } = await supabaseAdmin.storage
        .from("docs")
        .upload(storagePath.replace(/^docs\//, ""), f, {
          contentType: f.type,
          upsert: false,
        });

      if (upErr) {
        return NextResponse.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 });
      }

      // Make a row in documents
      const { error: insErr } = await supabaseAdmin.from("documents").insert({
        id,
        name: f.name,
        size: f.size,
        mimetype: f.type,
        storage_path: storagePath,
        bot_id: botId,
      });

      if (insErr) {
        return NextResponse.json({ error: `DB insert failed: ${insErr.message}` }, { status: 500 });
      }

      // Get a public URL if bucket is public
      const { data: pub } = supabaseAdmin.storage.from("docs").getPublicUrl(storagePath.replace(/^docs\//, ""));
      const publicUrl = pub?.publicUrl ?? null;

      results.push({
        id,
        name: f.name,
        publicUrl,
        size: f.size,
        mimetype: f.type,
      });
    }

    return NextResponse.json({ ok: true, files: results });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
