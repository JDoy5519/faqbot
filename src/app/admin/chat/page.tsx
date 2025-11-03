// src/app/admin/chat/page.tsx
"use client";

import { useState } from "react";

export default function AdminChatPage() {
  const [botId, setBotId] = useState("");
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<string>("");
  const [sources, setSources] = useState<
    { tag: string; document_id: string; page_start: number | null; page_end: number | null }[]
  >([]);
  const [loading, setLoading] = useState(false);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setAnswer("");
    setSources([]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bot_id: botId,
          messages: [{ role: "user", content: q }],
          top_k: 6,
        }),
      });
      const ct = res.headers.get("content-type") || "";
      const text = await res.text();
      const json = ct.includes("application/json") ? JSON.parse(text) : { ok: false, error: text };
      if (!json.ok) throw new Error(json.error || "Chat failed");
      setAnswer(json.answer || "");
      setSources(json.sources || []);
    } catch (err: any) {
      setAnswer(`Error: ${err.message || "Chat failed"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Admin · RAG Chat</h1>

      <form onSubmit={ask} className="space-y-3">
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
          <label className="block text-sm font-medium mb-1">Your question</label>
          <input
            className="w-full rounded-lg border p-2"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ask something from your docs…"
            required
          />
        </div>
        <button
          type="submit"
          className="rounded-xl px-4 py-2 bg-blue-600 text-white disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Thinking…" : "Ask"}
        </button>
      </form>

      {!!answer && (
        <div className="rounded-xl border p-4 shadow-sm space-y-3">
          <div className="prose whitespace-pre-wrap leading-relaxed">{answer}</div>
          {!!sources.length && (
            <div className="text-xs text-gray-600">
              {sources.map((s) => (
                <div key={s.tag}>
                  {s.tag}: doc {s.document_id} · pages {s.page_start ?? "?"}–{s.page_end ?? "?"}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
