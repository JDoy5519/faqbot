"use client";

import { useState, useRef } from "react";

export default function ImportPage() {
  const [botId, setBotId] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function toBase64(file: File): Promise<string> {
    const buf = await file.arrayBuffer();
    // base64 encode
    let binary = "";
    const bytes = new Uint8Array(buf);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      if (!botId) {
        setError("Please enter a bot ID.");
        setLoading(false);
        return;
      }
      if (!sourceUrl && !pdfFile) {
        setError("Provide either a URL or a PDF file.");
        setLoading(false);
        return;
      }

      let pdfBase64: string | undefined = undefined;
      if (pdfFile) {
        if (pdfFile.type !== "application/pdf") {
          setError("Selected file is not a PDF.");
          setLoading(false);
          return;
        }
        // optional: size guard (e.g., 8MB)
        if (pdfFile.size > 8 * 1024 * 1024) {
          setError("PDF is too large (limit ~8MB for this demo).");
          setLoading(false);
          return;
        }
        pdfBase64 = await toBase64(pdfFile);
      }

      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botId,
          sourceUrl: sourceUrl || undefined,
          pdfBase64,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Import failed");
      } else {
        setResult(`Inserted ${data.inserted || 0} chunks`);
        // reset fields if you want
        // setSourceUrl(""); setPdfFile(null); fileInputRef.current?.value = "";
      }
    } catch (err: any) {
      setError(err?.message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", fontFamily: "system-ui" }}>
      <h1 style={{ marginBottom: 8 }}>Import from URL / PDF</h1>
      <p style={{ color: "#555", marginBottom: 24 }}>
        Paste a web page URL or upload a PDF. We’ll extract text, chunk, embed, and store it for the selected bot.
      </p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 16 }}>
        <label style={{ display: "grid", gap: 8 }}>
          <span>Bot ID</span>
          <input
            value={botId}
            onChange={(e) => setBotId(e.target.value)}
            placeholder="e.g. 00000000-0000-0000-0000-000000000000"
            style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
            required
          />
        </label>

        <div style={{ display: "grid", gap: 8 }}>
          <span>Source URL (optional)</span>
          <input
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://example.com/docs"
            style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
          />
          <div style={{ color: "#777", fontSize: 13 }}>
            If URL is provided, we’ll fetch and parse text from the page.
          </div>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <span>PDF (optional)</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
          />
          <div style={{ color: "#777", fontSize: 13 }}>
            If a PDF is provided, it will be parsed for text. (Small files recommended.)
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #0d6efd",
            background: loading ? "#8cb3ff" : "#0d6efd",
            color: "#fff",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 600,
          }}
        >
          {loading ? "Importing…" : "Import"}
        </button>

        {result && (
          <div style={{ padding: 12, border: "1px solid #cce5cc", background: "#f6fff6", borderRadius: 8 }}>
            ✅ {result}
          </div>
        )}
        {error && (
          <div style={{ padding: 12, border: "1px solid #f5c2c7", background: "#fff5f5", borderRadius: 8 }}>
            ⚠️ {error}
          </div>
        )}
      </form>
    </main>
  );
}
