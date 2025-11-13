// src/app/api/admin/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

export async function POST(req: NextRequest) {
  if (!ADMIN_TOKEN) {
    return NextResponse.json(
      { ok: false, error: "ADMIN_TOKEN is not configured on the server." },
      { status: 500 }
    );
  }

  let token: string | undefined;

  try {
    const body = await req.json();
    token = body?.token;
  } catch {
    // no/invalid JSON
  }

  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Missing token." },
      { status: 400 }
    );
  }

  if (token !== ADMIN_TOKEN) {
    return NextResponse.json(
      { ok: false, error: "Invalid admin token." },
      { status: 401 }
    );
  }

  const res = NextResponse.json({ ok: true });

  res.cookies.set("admin_token", token, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return res;
}

