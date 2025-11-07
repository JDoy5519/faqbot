export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supaAdmin";

export async function POST(req: NextRequest) {
  try {
    const { org_id, price_id } = await req.json();

    const { data: org, error } = await supabaseAdmin
      .from("organizations")
      .select("id, name, stripe_customer_id")
      .eq("id", org_id)
      .single();

    if (error || !org) {
      return NextResponse.json({ ok: false, error: "Org not found" }, { status: 404 });
    }

    let customerId = org.stripe_customer_id;
    if (!customerId) {
      const cust = await stripe.customers.create({ name: org.name || `Customer ${org.id}` });
      customerId = cust.id;
      await supabaseAdmin.from("organizations").update({ stripe_customer_id: customerId }).eq("id", org.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: price_id, quantity: 1 }],
      success_url: process.env.BILLING_RETURN_URL!,
      cancel_url: process.env.BILLING_RETURN_URL!,
      metadata: { org_id },
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
  }
}

