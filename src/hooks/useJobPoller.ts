// src/hooks/useJobPoller.ts
"use client";

import { useEffect, useRef, useState } from "react";

export type JobState = "queued" | "running" | "succeeded" | "failed";
export type JobSnapshot = {
  id: string;
  state: JobState;
  progress_percent: number | null;
  error_message?: string | null;
  document_id?: string | null;
};

export function useJobPoller(jobId?: string, intervalMs = 1500) {
  const [snap, setSnap] = useState<JobSnapshot | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const fetchOnce = async () => {
      try {
        const r = await fetch(`/api/admin/jobs/${jobId}`, { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as JobSnapshot;
        setSnap(j);
        if (j.state === "succeeded" || j.state === "failed") {
          if (timerRef.current) window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
      } catch {
        // ignore transient errors
      }
    };

    fetchOnce();
    timerRef.current = window.setInterval(fetchOnce, intervalMs) as unknown as number;
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [jobId, intervalMs]);

  const progress = Math.max(
    0,
    Math.min(100, Number(snap?.progress_percent ?? 0))
  );

  return { snap, progress };
}
