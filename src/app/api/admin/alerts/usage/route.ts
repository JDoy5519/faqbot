// src/app/api/admin/alerts/usage/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supaAdmin";
import { getOrgQuota } from "@/lib/quota";

const MODE = process.env.NODE_ENV || "development";

// Choose a mailer: Resend (default)
const USE_RESEND = (process.env.EMAIL_PROVIDER || "resend").toLowerCase() === "resend";
const FROM_EMAIL = process.env.ALERTS_FROM_EMAIL || "alerts@your-domain";
const ADMIN_FALLBACK = process.env.ALERTS_ADMIN_EMAIL || ""; // fallback if no org email

async function sendEmailResend(to: string[], subject: string, html: string) {
  const key = process.env.RESEND_API_KEY || "";
  if (!key) throw new Error("RESEND_API_KEY missing");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Resend failed: ${res.status} ${text}`);
  }
}

// SMTP2Go variant (optional)
// async function sendEmailSMTP2Go(to: string[], subject: string, html: string) {
//   const apiKey = process.env.SMTP2GO_API_KEY || "";
//   if (!apiKey) throw new Error("SMTP2GO_API_KEY missing");
//   const res = await fetch("https://api.smtp2go.com/v3/email/send", {
//     method: "POST",
//     headers: { "content-type": "application/json" },
//     body: JSON.stringify({
//       api_key: apiKey,
//       to,
//       sender: FROM_EMAIL,
//       subject,
//       html_body: html,
//     }),
//   });
//   const j = await res.json().catch(() => ({}));
//   if (j?.data?.succeeded !== 1) throw new Error(`SMTP2GO failed: ${JSON.stringify(j)}`);
// }

async function sendEmail(to: string[], subject: string, html: string) {
  if (USE_RESEND) return sendEmailResend(to, subject, html);
  // return sendEmailSMTP2Go(to, subject, html);
}

function emailHtml(orgName: string, used: number, cap: number, pct: number) {
  const bar = Math.max(0, Math.min(100, Math.round((used / cap) * 100)));
  return `
    <div style="font-family: system-ui, Segoe UI, Roboto, sans-serif; max-width:600px; margin:auto;">
      <h2>Usage alert — ${orgName}</h2>
      <p>Your organization has used <b>${used}</b> of <b>${cap}</b> this period (<b>${pct}%</b>).</p>
      <div style="height:10px; background:#eee; border-radius:6px; overflow:hidden;">
        <div style="height:10px; width:${bar}%; background:${bar >= 90 ? "#ef4444" : bar >= 80 ? "#f59e0b" : "#3b82f6"}"></div>
      </div>
      <p style="margin-top:12px;">Consider upgrading to avoid interruptions.</p>
    </div>
  `;
}

export async function GET(req: NextRequest) {
  try {
    // Simple auth: allow only from Vercel Cron or your own secret
    const secret = req.headers.get("x-cron-secret") || "";
    const expected = process.env.CRON_SECRET || "";
    if (!expected || secret !== expected) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // Fetch active orgs
    const { data: orgs, error: orgErr } = await supabaseAdmin
      .from("organizations")
      .select("id, name, plan_name, is_active, billing_email")
      .eq("is_active", true);
    if (orgErr) throw new Error(orgErr.message);

    let alerted = 0;

    for (const org of orgs || []) {
      const quota = await getOrgQuota(org.id); // { used, cap, warn, over }
      const used = Number(quota.used || 0);
      const cap = Number(quota.cap || 0);
      if (!cap || cap <= 0) continue;

      const pct = Math.round((used / cap) * 100);
      const tooHigh = pct >= 80;

      if (!tooHigh) continue;

      // check if we already sent today
      const today = new Date().toISOString().slice(0, 10);
      const { data: already } = await supabaseAdmin
        .from("usage_events")
        .select("id")
        .eq("org_id", org.id)
        .eq("event_type", "quota_alert")
        .gte("created_at", `${today}T00:00:00Z`)
        .limit(1);

      if (already && already.length) continue; // already alerted today

      const recipients: string[] = [];
      if (org.billing_email) recipients.push(org.billing_email);
      if (!recipients.length && ADMIN_FALLBACK) recipients.push(ADMIN_FALLBACK);
      if (!recipients.length) continue;

      if (MODE !== "production") {
        // don't actually email in dev unless you want to
        // you can still return success to test the code path
      } else {
        await sendEmail(recipients, `Usage alert: ${pct}% of plan used`, emailHtml(org.name || "Your org", used, cap, pct));
      }

      // Log so we don’t spam
      await supabaseAdmin.from("usage_events").insert({
        org_id: org.id,
        event_type: "quota_alert",
        meta: { pct, used, cap },
      });

      alerted++;
    }

    return NextResponse.json({ ok: true, alerted });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}
