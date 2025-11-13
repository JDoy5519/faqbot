// src/lib/adminAuth.ts
import { cookies, headers } from "next/headers";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

/**
 * Ensures the current request is from an authenticated admin.
 *
 * Accepts token from:
 * - Cookie: admin_token (new flow)
 * - Cookie: faqbot_admin === "1" (backwards compat)
 * - Header: x-admin-token
 * - Header: Authorization: Bearer <token>
 *
 * Throws an Error with .status = 401 if not authorised.
 */
export async function ensureAdminOrThrow() {
  // In dev, if no ADMIN_TOKEN is configured, fail open
  if (!ADMIN_TOKEN) return;

  const cookieStore = await cookies();

  // New flow: admin_token must match ADMIN_TOKEN
  const adminTokenCookie = cookieStore.get("admin_token")?.value;

  if (adminTokenCookie && adminTokenCookie === ADMIN_TOKEN) {
    return;
  }

  // Old flow (backwards compat): faqbot_admin === "1"
  const legacyCookie = cookieStore.get("faqbot_admin")?.value;
  if (legacyCookie === "1") {
    return;
  }

  // Headers
  const h = await headers();

  // x-admin-token header
  const headerToken = h.get("x-admin-token");

  // Authorization: Bearer <token>
  const auth = h.get("authorization");
  const bearer = auth?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;

  const presented = headerToken || bearer || "";

  if (presented && presented === ADMIN_TOKEN) {
    return;
  }

  const err: any = new Error("Unauthorized");
  err.status = 401;
  throw err;
}


