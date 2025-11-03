// src/lib/adminAuth.ts
// src/lib/adminAuth.ts
import { cookies, headers } from "next/headers";

/**
 * Ensures the current request is from an authenticated admin.
 * Checks the faqbot_admin cookie OR the x-admin-token header.
 * Throws an Error (with .status = 401) if not authorized.
 */
export async function ensureAdminOrThrow() {
  // Option A: cookie set by /api/admin/auth/login
  const cookieStore = await cookies();
  const cookieVal = cookieStore.get("faqbot_admin")?.value;
  if (cookieVal === "1") return;

  // Option B: header for scripts/curl
  const headerStore = await headers();
  const hdr = headerStore.get("x-admin-token");
  if (hdr && process.env.ADMIN_TOKEN && hdr === process.env.ADMIN_TOKEN) return;

  const err = new Error("Unauthorized");
  (err as any).status = 401;
  throw err;
}

