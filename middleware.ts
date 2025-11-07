// middleware.ts (project root)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ADMIN_COOKIE = "faqbot_admin";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // --- Allow embedding of /public/embed (CSP) ---
  if (pathname.startsWith("/public/embed")) {
    const res = NextResponse.next();
    // Allow all ancestors (you can lock this to specific domains later)
    res.headers.set("Content-Security-Policy", "frame-ancestors *");
    // Remove X-Frame-Options so CSP is effective (ALLOWALL isn't a valid value)
    res.headers.delete("X-Frame-Options");
    return res;
  }

  // --- Protect /admin (except /admin/login) ---
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const cookie = req.cookies.get(ADMIN_COOKIE)?.value;
    if (!cookie) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

// Only run on these routes
export const config = {
  matcher: ["/public/embed", "/admin/:path*"],
};
