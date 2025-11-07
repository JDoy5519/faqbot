/**
 * Thin wrapper over fetch that:
 * - reads x-quota-warning
 * - calls a provided onWarn callback so your UI can toast
 */
export async function fetchWithQuotaToast(
  input: RequestInfo | URL,
  init: RequestInit & { onWarn?: (msg: string) => void } = {}
) {
  const res = await fetch(input, init);
  const warn = res.headers.get("x-quota-warning");
  if (warn && typeof init.onWarn === "function") init.onWarn(warn);
  return res;
}
