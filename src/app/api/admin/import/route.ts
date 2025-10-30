// src/app/api/admin/import/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supaServer } from "@/lib/supaServer";
import { embedTexts } from "@/lib/ai";

async function loadPdfParseCJS() {
  const { createRequire } = await import("module");
  const require = createRequire(import.meta.url);
  const candidates = [
    "pdf-parse/lib/pdf-parse.js",
    "pdf-parse/dist/pdf-parse.js",
    "pdf-parse",
  ];
  for (const p of candidates) {
    try {
      const mod: any = require(p);
      const fn =
        (typeof mod === "function" && mod) ||
        (typeof mod?.default === "function" && mod.default);
      if (fn) return fn as (data: Buffer | Uint8Array | ArrayBuffer, opts?: any) => Promise<{ text: string }>;
    } catch {}
  }
  return null;
}

async function loadPdfJsCJS() {
  const { createRequire } = await import("module");
  const require = createRequire(import.meta.url);

  const candidates = [
    "pdfjs-dist/legacy/build/pdf.js",
    "pdfjs-dist/build/pdf.js",
    "pdfjs-dist/es5/build/pdf.js",
    "pdfjs-dist",
  ];

  for (const p of candidates) {
    try {
      const mod: any = require(p);
      if (mod?.getDocument) return mod;
    } catch {
      // try next candidate
    }
  }
  return null;
}


async function extractTextWithPdfJs(buffer: Buffer): Promise<string> {
  const pdfjs = await loadPdfJsCJS();
  if (!pdfjs) throw new Error("pdfjs-dist build not found (tried multiple paths).");

  // No worker in Node
  if (pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = undefined;
  }

  const loadingTask = pdfjs.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;

  let fullText = "";
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => ("str" in item ? item.str : (item?.text ?? "")))
      .join(" ");
    fullText += pageText + "\n\n";
  }
  return fullText;
}

async function extractTextFromURL(url: string) {
  const { JSDOM } = await import("jsdom");
  const html = await fetch(url).then((r) => r.text());
  const dom = new JSDOM(html);
  return dom.window.document.body.textContent || "";
}

export async function POST(req: NextRequest) {
  try {
    const { botId, sourceUrl, pdfBase64 } = await req.json();

    const supa = await supaServer();
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    let text = "";

    if (sourceUrl) {
      text = await extractTextFromURL(sourceUrl);
    }

    // src/app/api/admin/import/route.ts
// ...
if (pdfBase64) {
  const mod: any = await import("pdf-parse");
  const pdfParse = (mod?.default ?? mod) as (data: Buffer | Uint8Array | ArrayBuffer) => Promise<{ text: string }>;

  const data = Buffer.from(pdfBase64, "base64");
  const parsed = await pdfParse(data);
  text = parsed?.text ?? "";
}


const cleaned = text.replace(/\s+/g, " ").trim();
const chunks = cleaned.match(/.{1,1000}(\s|$)/g) ?? [];


    if (chunks.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0, note: "No text found to import." });
    }

    const vectors = await embedTexts(chunks);
    const rows = chunks.map((content, i) => ({ bot_id: botId, content, embedding: vectors[i] }));

    const { error } = await supa.from("doc_chunks").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, inserted: rows.length });
  } catch (e: any) {
    console.error("IMPORT_FAILED:", e);
    return NextResponse.json({ error: e?.message || "import failed" }, { status: 500 });
  }
}







