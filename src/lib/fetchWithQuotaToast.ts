// src/lib/fetchWithQuotaToast.ts
import { toast } from "sonner";

export type QuotaHeaderBundle = {
  used: string | null;
  cap: string | null;
  warn: string | null;
  over: string | null;
};

export type QuotaRequestInit = RequestInit & {
  /**
   * Optional callback when server signals a quota warning.
   * If omitted, we fall back to a default toast.
   */
  onWarn?: (message: string) => void;
};

/**
 * Shared helper to inspect quota-related header values.
 * Can be called from XHR code (using getResponseHeader)
 * or from fetch-based helpers that construct this bundle.
 */
export function handleQuotaHeaderValues(
  bundle: QuotaHeaderBundle,
  onWarn?: (message: string) => void
) {
  const { warn } = bundle;

  if (!warn) return;

  if (onWarn) {
    onWarn(warn);
  } else {
    toast(warn);
  }
}

/**
 * Wrapper around fetch that automatically surfaces quota warnings
 * via toast (or a custom onWarn callback).
 */
export async function fetchWithQuotaToast(
  input: RequestInfo | URL,
  init: QuotaRequestInit = {}
) {
  const { onWarn, ...fetchInit } = init;

  const res = await fetch(input, fetchInit);

  const bundle: QuotaHeaderBundle = {
    used: res.headers.get("x-plan-used"),
    cap: res.headers.get("x-plan-cap"),
    warn: res.headers.get("x-plan-warn") ?? res.headers.get("x-quota-warn"),
    over: res.headers.get("x-plan-over"),
  };

  handleQuotaHeaderValues(bundle, onWarn);

  return res;
}




