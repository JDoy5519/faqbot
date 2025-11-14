// src/app/api/billing/checkout/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe"; // Clover client
import { supabaseAdmin } from "@/lib/supaAdmin";
import { ensureAdminOrThrow } from "@/lib/adminAuth";

export async function POST(req: NextRequest) {
  try {
    // 1) Admin gate: must be logged in as admin
    await ensureAdminOrThrow();

    // 2) Get your one-and-only org (for now)
    const { data: org, error: orgError } = await supabaseAdmin
      .from("organizations")
      .select("id, name, stripe_customer_id")
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (orgError || !org) {
      return NextResponse.json(
        { ok: false, error: "No organization found for checkout" },
        { status: 400 }
      );
    }

    // 3) Decide which price to use (starter by default)
    const priceId =
      process.env.STRIPE_PRICE_FAQ_STARTER || process.env.STRIPE_PRICE_FAQ_PRO;

    if (!priceId) {
      return NextResponse.json(
        { ok: false, error: "Missing STRIPE_PRICE_FAQ_STARTER/PRO env var" },
        { status: 500 }
      );
    }

    // 4) Build return URLs from the request origin (bulletproof)
    const origin = req.nextUrl.origin; // e.g. https://faqbot1.vercel.app
    const successUrl = `${origin}/admin/settings/billing?result=success`;
    const cancelUrl = `${origin}/admin/settings/billing?result=cancelled`;

    // 5) Ensure we have/create a Stripe customer for this org
    let customerId = org.stripe_customer_id || undefined;
    if (!customerId) {
      const cust = await stripe.customers.create({
        name: org.name || `Customer ${org.id}`,
      });
      customerId = cust.id;
      await supabaseAdmin
        .from("organizations")
        .update({ stripe_customer_id: customerId })
        .eq("id", org.id);
    }

    // 6) Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { org_id: org.id },
    });

    if (!session.url) {
      return NextResponse.json(
        { ok: false, error: "Stripe session created but no URL returned" },
        { status: 500 }
      );
    }

    // 7) Return JSON the frontend is already expecting
    return NextResponse.json({ ok: true, url: session.url });
  } catch (e: any) {
    console.error("checkout error", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Checkout error" },
      { status: 500 }
    );
  }
}

