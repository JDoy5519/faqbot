// src/lib/adminAuth.ts
import { NextRequest } from "next/server";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

/**
 * Throws 401 if the incoming request is not authorised as admin.
 * Accepts token from:
 * - Cookie: admin_token
 * - Header: x-admin-token
 * - Query:  ?token=...
 */
export function ensureAdminOrThrow(req: NextRequest) {
  // In dev, if no ADMIN_TOKEN is configured, fail open
  if (!ADMIN_TOKEN) return;

  const url = new URL(req.url);

  const cookieToken = req.cookies.get("admin_token")?.value;
  const headerToken = req.headers.get("x-admin-token");
  const queryToken = url.searchParams.get("token");

  const incoming = cookieToken || headerToken || queryToken;

  if (incoming !== ADMIN_TOKEN) {
    const err: any = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }
}


