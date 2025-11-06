// src/lib/adminAuth.ts
// src/lib/adminAuth.ts
import { cookies, headers } from "next/headers";

/**
 * Ensures the current request is from an authenticated admin.
 * Checks the faqbot_admin cookie OR the x-admin-token header.
 * Throws an Error (with .status = 401) if not authorized.
 */
export async function ensureAdminOrThrow() {
  // A) Cookie
  const cookieVal = (await cookies()).get("faqbot_admin")?.value;
  if (cookieVal === "1") return;

  // B) Headers
  const h = await headers();

  // x-admin-token header
  const tokenHeader = h.get("x-admin-token");

  // Authorization: Bearer <token>
  const auth = h.get("authorization");
  const bearer = auth?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;

  const presented = tokenHeader || bearer || "";
  const expected = process.env.ADMIN_TOKEN || "";

  if (presented && expected && presented === expected) return;

  const err = new Error("Unauthorized");
  (err as any).status = 401;
  throw err;
}

