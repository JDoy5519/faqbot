"use client";

import { useEffect, useMemo, useState } from "react";

type Row = {
  id: string;
  bot_id: string;
  title: string | null;
  source_type: string | null;
  created_at: string;
  chunk_count: number;
  embedding_count: number;
};

export default function AdminDocumentsPage() {
  const [botId, setBotId] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const qs = botId ? `?bot_id=${encodeURIComponent(botId)}` : "";
      const res = await fetch(`/api/admin/documents${qs}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "List failed");
      setRows(json.documents || []);
    } catch (e: any) {
      alert(`Load failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []); // initial load

  async function reembed(id: string) {
    setActionId(id);
    try {
      const res = await fetch(`/api/admin/documents/${id}/reembed`, { method: "POST" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Re-embed failed");
      await load();
    } catch (e: any) {
      alert(`Re-embed failed: ${e.message}`);
    } finally {
      setActionId(null);
    }
  }

  async function del(id: string) {
    if (!confirm("Delete this document and its chunks/embeddings? This cannot be undone.")) return;
    setActionId(id);
    try {
      const res = await fetch(`/api/admin/documents/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Delete failed");
      setRows((r) => r.filter((x) => x.id !== id));
    } catch (e: any) {
      alert(`Delete failed: ${e.message}`);
    } finally {
      setActionId(null);
    }
  }

  const total = useMemo(() => ({
    docs: rows.length,
    chunks: rows.reduce((a, r) => a + (r.chunk_count || 0), 0),
    embeds: rows.reduce((a, r) => a + (r.embedding_count || 0), 0),
  }), [rows]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Admin · Documents</h1>

      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">Filter by Bot ID (optional)</label>
          <input
            className="w-full rounded-lg border p-2"
            value={botId}
            onChange={(e) => setBotId(e.target.value)}
            placeholder="00000000-0000-0000-0000-000000000000"
          />
        </div>
        <button onClick={load} className="rounded-xl px-4 py-2 bg-blue-600 text-white disabled:opacity-60" disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      <div className="text-sm text-gray-600">
        <span className="mr-4">Docs: <b>{total.docs}</b></span>
        <span className="mr-4">Chunks: <b>{total.chunks}</b></span>
        <span>Embeddings: <b>{total.embeds}</b></span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-3">Title</th>
              <th className="py-2 pr-3">Source</th>
              <th className="py-2 pr-3">Bot</th>
              <th className="py-2 pr-3">Chunks</th>
              <th className="py-2 pr-3">Embeds</th>
              <th className="py-2 pr-3">Created</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="py-2 pr-3">{r.title || "(untitled)"}<div className="text-xs text-gray-500">{r.id}</div></td>
                <td className="py-2 pr-3">{r.source_type || "-"}</td>
                <td className="py-2 pr-3"><code className="text-xs">{r.bot_id}</code></td>
                <td className="py-2 pr-3">{r.chunk_count}</td>
                <td className="py-2 pr-3">{r.embedding_count}</td>
                <td className="py-2 pr-3">{new Date(r.created_at).toLocaleString()}</td>
                <td className="py-2 flex gap-2">
                  <button
                    onClick={() => reembed(r.id)}
                    disabled={actionId === r.id}
                    className="rounded-lg px-3 py-1 border"
                  >
                    {actionId === r.id ? "Re-embedding…" : "Re-embed"}
                  </button>
                  <button
                    onClick={() => del(r.id)}
                    disabled={actionId === r.id}
                    className="rounded-lg px-3 py-1 border text-red-600"
                  >
                    {actionId === r.id ? "Deleting…" : "Delete"}
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && !loading && (
              <tr><td colSpan={7} className="py-6 text-center text-gray-500">No documents yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
