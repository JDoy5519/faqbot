export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

const ADMIN_COOKIE = "faqbot_admin";

export async function POST(req: NextRequest) {
  const { token } = await req.json().catch(() => ({}));
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });
  return res;
}
