// middleware.ts
import { NextRequest, NextResponse } from "next/server";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

// Only protect /admin routes; everything else passes through.
export function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const { pathname, searchParams } = url;

  // Only touch /admin routes
  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  // Always allow the login page itself
  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  // If no ADMIN_TOKEN is set at all, fail open (so you don't lock yourself out)
  if (!ADMIN_TOKEN) {
    return NextResponse.next();
  }

  // Try to read token from cookie, header, or querystring
  const cookieToken = req.cookies.get("admin_token")?.value;
  const headerToken = req.headers.get("x-admin-token");
  const queryToken = searchParams.get("token");

  const incoming = cookieToken || headerToken || queryToken;

  if (incoming === ADMIN_TOKEN) {
    // If it came via header/query, persist it as a cookie
    if (!cookieToken && incoming) {
      const res = NextResponse.next();
      res.cookies.set("admin_token", incoming, {
        httpOnly: true,
        path: "/",
        sameSite: "lax",
      });
      return res;
    }
    return NextResponse.next();
  }

  // Not authorised → redirect to /admin/login (NOT /)
  return NextResponse.redirect(new URL("/admin/login", req.url));
}

export const config = {
  matcher: ["/admin/:path*"],
};

