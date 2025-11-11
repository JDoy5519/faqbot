// src/lib/fetchWithQuotaToast.ts
import { toast } from "sonner";

// These are the headers your server sets via buildQuotaHeaders(quota)
const H_USED = "x-plan-used";
const H_CAP = "x-plan-cap";
const H_WARN = "x-plan-warn";
const H_OVER = "x-plan-over";

// Core: call this with a Headers object
export function handleQuotaHeaders(headers: Headers) {
  const used = Number(headers.get(H_USED) || "0");
  const cap = Number(headers.get(H_CAP) || "0");
  const warn = (headers.get(H_WARN) || "").toLowerCase() === "true";
  const over = (headers.get(H_OVER) || "").toLowerCase() === "true";

  if (over) {
    toast.error(`You’ve exceeded your monthly plan limit.`, { id: "quota-over" });
  } else if (warn && cap > 0) {
    const pct = Math.min(100, Math.round((used / cap) * 100));
    toast.warning(`You’re at ${pct}% of your monthly limit (${used}/${cap}).`, { id: "quota-warn" });
  }
}

// Convenience: call this when you only have raw header values (e.g., XHR)
export function handleQuotaHeaderValues(opts: {
  used?: string | null;
  cap?: string | null;
  warn?: string | null;
  over?: string | null;
}) {
  const h = new Headers();
  if (opts.used != null) h.set(H_USED, String(opts.used));
  if (opts.cap != null) h.set(H_CAP, String(opts.cap));
  if (opts.warn != null) h.set(H_WARN, String(opts.warn));
  if (opts.over != null) h.set(H_OVER, String(opts.over));
  handleQuotaHeaders(h);
}

// Drop-in replacement for fetch
export async function fetchWithQuotaToast(input: RequestInfo | URL, init?: RequestInit) {
  const res = await fetch(input, init);
  // fire toast from headers (non-blocking)
  try {
    handleQuotaHeaders(res.headers);
  } catch {}
  return res;
}

