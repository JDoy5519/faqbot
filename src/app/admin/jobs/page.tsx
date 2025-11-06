"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Job = {
  id: string;
  org_id: string;
  bot_id: string | null;
  type: string;
  status: "queued"|"running"|"done"|"error";
  payload: any;
  created_at: string;
  updated_at: string | null;
  error_message?: string | null;
};

export default function JobsPage() {
  const [rows, setRows] = useState<Job[]>([]);
  const [status, setStatus] = useState<string>("");
  const [type, setType] = useState<string>("");
  const [orgId, setOrgId] = useState<string>("");
  const [botId, setBotId] = useState<string>("");

  async function fetchRows() {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (type) params.set("type", type);
    if (orgId) params.set("org_id", orgId);
    if (botId) params.set("bot_id", botId);
    const res = await fetch(`/api/admin/jobs?${params.toString()}`);
    const j = await res.json();
    if (!j.ok) toast.error(j.error || "Failed to load jobs");
    setRows(j.jobs || []);
  }

  useEffect(() => { fetchRows(); }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white">
        <div className="border-b p-4">
          <h2 className="text-lg font-semibold">Jobs</h2>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            <select
              value={status}
              onChange={e=>setStatus(e.target.value)}
              className="h-9 rounded-md border px-3"
            >
              <option value="">Any</option>
              <option value="queued">Queued</option>
              <option value="running">Running</option>
              <option value="done">Done</option>
              <option value="error">Error</option>
            </select>

            <input
              placeholder="Type (e.g. embed_doc)"
              value={type}
              onChange={e=>setType(e.target.value)}
              className="h-9 rounded-md border px-3"
            />
            <input
              placeholder="Org ID"
              value={orgId}
              onChange={e=>setOrgId(e.target.value)}
              className="h-9 rounded-md border px-3"
            />
            <input
              placeholder="Bot ID"
              value={botId}
              onChange={e=>setBotId(e.target.value)}
              className="h-9 rounded-md border px-3"
            />
            <button
              onClick={fetchRows}
              className="h-9 rounded-md border px-3 font-medium hover:bg-gray-50"
            >
              Apply
            </button>
          </div>

          <div className="border rounded-md">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-2">Created</th>
                  <th className="text-left p-2">Type</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Org</th>
                  <th className="text-left p-2">Bot</th>
                  <th className="text-left p-2">Error</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r=>(
                  <tr key={r.id} className="border-t">
                    <td className="p-2">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="p-2">{r.type}</td>
                    <td className="p-2">{r.status}</td>
                    <td className="p-2">{r.org_id.slice(0,8)}…</td>
                    <td className="p-2">{r.bot_id ?? "-"}</td>
                    <td className="p-2 text-red-600 truncate max-w-[240px]">{r.error_message ?? ""}</td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr><td className="p-4 text-gray-500" colSpan={6}>No jobs yet. Trigger an action (e.g., re-embed a document).</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
