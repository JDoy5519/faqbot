export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supaAdmin";

export async function POST(req: NextRequest) {
  try {
    const { org_id } = await req.json();

    const { data: org, error } = await supabaseAdmin
      .from("organizations")
      .select("id, stripe_customer_id")
      .eq("id", org_id)
      .single();

    if (error || !org?.stripe_customer_id) {
      return NextResponse.json({ ok: false, error: "Missing stripe_customer_id" }, { status: 400 });
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: process.env.BILLING_PORTAL_RETURN_URL!,
    });

    return NextResponse.json({ ok: true, url: portal.url });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
  }
}

