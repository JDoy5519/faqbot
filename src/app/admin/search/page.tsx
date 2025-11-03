// src/app/admin/search/page.tsx
"use client";

import { useState } from "react";

export default function AdminSearchPage() {
  const [botId, setBotId] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<
    { score: number; content: string; document_id: string; source_page_start: number | null; source_page_end: number | null }[]
  >([]);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResults([]);
    try {
      const res = await fetch("/api/admin/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ q, bot_id: botId, top_k: 8 }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Search failed");
      setResults(json.matches || []);
    } catch (err: any) {
      alert(err.message || "Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Admin · Semantic Search</h1>

      <form onSubmit={runSearch} className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Bot ID (UUID)</label>
          <input
            className="w-full rounded-lg border p-2"
            value={botId}
            onChange={(e) => setBotId(e.target.value)}
            placeholder="00000000-0000-0000-0000-000000000000"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Query</label>
          <input
            className="w-full rounded-lg border p-2"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ask a question…"
            required
          />
        </div>

        <button
          type="submit"
          className="rounded-xl px-4 py-2 bg-blue-600 text-white disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {!!results.length && (
        <div className="space-y-4">
          {results.map((r, i) => (
            <div key={i} className="rounded-xl border p-4 shadow-sm">
              <div className="text-xs text-gray-500 mb-2">
                score: {r.score.toFixed(3)} · doc: {r.document_id} · pages:{" "}
                {r.source_page_start ?? "?"}–{r.source_page_end ?? "?"}
              </div>
              <pre className="whitespace-pre-wrap leading-relaxed text-sm">
                {r.content}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
