// src/app/admin/upload/UploadForm.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useJobPoller } from "@/hooks/useJobPoller";

type Bot = { id: string; name: string };

// ---- Upload API response shapes ----
type UploadFileInfo = {
  document_id: string;
  job_id: string | null;
  name: string;
  publicUrl: string | null;
  size: number;
  mimetype: string;
};

type UploadResponse = {
  ok?: boolean;
  error?: string;

  // canonical
  document_id?: string | null;
  job_id?: string | null;

  // aliases
  id?: string | null;
  jobId?: string | null;
  documentId?: string | null;

  files?: UploadFileInfo[];
};

// Normalise server response into ids we need
function extractIds(resp: UploadResponse | any): { jobId: string | null; docId: string | null } {
  const first = (resp?.files && Array.isArray(resp.files) && resp.files[0]) || null;
  const jobId = resp?.job_id ?? resp?.jobId ?? first?.job_id ?? null;
  const docId =
    resp?.document_id ?? resp?.documentId ?? resp?.id ?? first?.document_id ?? null;
  return { jobId, docId };
}

export default function UploadForm() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [botId, setBotId] = useState<string>("");
  const [jobIdState, setJobIdState] = useState<string | undefined>();
  const [docIdState, setDocIdState] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const { snap, progress } = useJobPoller(jobIdState);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/admin/bots/lookup", { cache: "no-store" });
      if (!r.ok) return;
      const data = await r.json();
      const list: Bot[] = data.bots ?? data ?? [];
      setBots(list);
      if (list.length && !botId) setBotId(list[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!botId) {
      alert("Select a bot first.");
      return;
    }
    fd.append("bot_id", botId);

    setSubmitting(true);
    setJobIdState(undefined);
    setDocIdState(undefined);

    try {
      const res = await fetch("/api/admin/uploads", { method: "POST", body: fd });
      const json = (await res.json()) as UploadResponse;

      // Debug: verify shape in browser console
      console.log("[UPLOAD] server JSON →", json);

      if (!res.ok || json.error) {
        alert(json.error || "Upload failed");
        return;
      }

      const ids = extractIds(json);
      if (!ids.jobId) {
        alert("No job_id returned from upload.");
        return;
      }

      setJobIdState(ids.jobId);
      if (ids.docId) setDocIdState(ids.docId);
    } catch (err) {
      console.error(err);
      alert("Upload failed.");
    } finally {
      setSubmitting(false);
    }
  }

  const state = snap?.state ?? (jobIdState ? "queued" : "idle");

  return (
    <div className="rounded-md border p-4">
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block">Bot</span>
          <select
            value={botId}
            onChange={(e) => setBotId(e.target.value)}
            className="w-full rounded border px-2 py-1"
            required
            name="bot_id"
          >
            {bots.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>

        <input name="file" type="file" accept="application/pdf" required className="block w-full text-sm" />

        <button className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50" disabled={submitting}>
        {submitting ? "Uploading… (v53)" : "Upload & Process (v53)"}
        </button>
      </form>

      {jobIdState && (
        <div className="mt-4 text-sm">
          <div className="mb-1">Job: {jobIdState}</div>
          <div className="h-2 w-full rounded bg-gray-100" aria-hidden="true">
            <div className="h-2 rounded bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-2">
            {state} — {progress}%{" "}
            {snap?.error_message ? <span className="ml-2 text-red-600">{snap.error_message}</span> : null}
          </div>
          {state === "succeeded" && (
            <div className="mt-3 flex gap-3">
              <Link className="text-blue-600 underline" href="/admin/search">
                Test search →
              </Link>
              {docIdState ? (
                <Link
                  className="text-blue-600 underline"
                  href={`/admin/documents?id=${encodeURIComponent(docIdState)}`}
                >
                  View document →
                </Link>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
