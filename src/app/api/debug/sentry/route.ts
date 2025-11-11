import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    throw new Error("Sentry test: manual throw");
  } catch (e) {
    Sentry.captureException(e);
    return NextResponse.json({ ok: true, sent: true });
  }
}
