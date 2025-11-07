export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supaAdmin";
// pick a consolidated period from subscription items
import type Stripe from "stripe";

function derivePeriodFromItems(sub: Stripe.Subscription) {
  const items = sub.items?.data ?? [];
  const starts = items.map(i => i.current_period_start ?? 0).filter(Boolean);
  const ends   = items.map(i => i.current_period_end   ?? 0).filter(Boolean);

  // If nothing is present (edge cases), fall back to "now"
  const startTs = starts.length ? Math.max(...starts) : Math.floor(Date.now() / 1000);
  const endTs   = ends.length   ? Math.min(...ends)   : startTs;

  return {
    periodStartISO: new Date(startTs * 1000).toISOString(),
    periodEndISO:   new Date(endTs   * 1000).toISOString(),
  };
}


function unwrap<T>(r: Stripe.Response<T> | T): T {
  return r as T;
}

function planFromPrice(priceId: string): string | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_FAQ_STARTER) return "starter";
  if (priceId === process.env.STRIPE_PRICE_FAQ_PRO) return "pro";
  return null;
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature") || "";
  const raw = await req.arrayBuffer();

  let evt: Stripe.Event;
  try {
    evt = stripe.webhooks.constructEvent(Buffer.from(raw), sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: `Webhook signature failed: ${err.message}` }, { status: 400 });
  }

  try {
    switch (evt.type) {
      case "checkout.session.completed": {
        const s = evt.data.object as Stripe.Checkout.Session;
        const org_id = s.metadata?.org_id;
        if (!org_id) break;

        if (s.subscription) {
          const subId = typeof s.subscription === "string" ? s.subscription : s.subscription.id;
          const sub = unwrap(await stripe.subscriptions.retrieve(subId));

          const { periodStartISO, periodEndISO } = derivePeriodFromItems(sub);


          await supabaseAdmin.from("organizations").update({
            stripe_subscription_id: sub.id,
            stripe_customer_id: s.customer as string,
            period_start: periodStartISO,
            period_end: periodEndISO,
            plan_id: planFromPrice(sub.items.data[0]?.price?.id || ""),
          }).eq("id", org_id);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = evt.data.object as Stripe.Subscription;

        const { data: org } = await supabaseAdmin
          .from("organizations")
          .select("id")
          .eq("stripe_customer_id", sub.customer as string)
          .single();
        if (!org) break;

        const { periodStartISO, periodEndISO } = derivePeriodFromItems(sub);


        await supabaseAdmin.from("organizations").update({
          stripe_subscription_id: sub.id,
          period_start: periodStartISO,
          period_end: periodEndISO  ,
          plan_id: planFromPrice(sub.items.data[0]?.price?.id || ""),
        }).eq("id", org.id);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = evt.data.object as Stripe.Subscription;

        const { data: org } = await supabaseAdmin
          .from("organizations")
          .select("id")
          .eq("stripe_customer_id", sub.customer as string)
          .single();
        if (!org) break;

        await supabaseAdmin.from("organizations").update({
          plan_id: null,
          stripe_subscription_id: null,
          period_start: null,
          period_end: null,
        }).eq("id", org.id);
        break;
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
  }
}


