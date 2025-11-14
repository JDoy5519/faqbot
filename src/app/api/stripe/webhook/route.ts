// src/app/api/stripe/webhook/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe"; // Clover client
import { supabaseAdmin } from "@/lib/supaAdmin";
import { requireEnv } from "@/lib/requireEnv";

const webhookSecret = requireEnv("STRIPE_WEBHOOK_SECRET");

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const body = await req.text(); // raw body, NOT json()
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error("[stripe] webhook signature error", err?.message || err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    console.log("[stripe] event type:", event.type);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = session.metadata?.org_id as string | undefined;
        const customerId = session.customer as string | null;
        const subscriptionId = session.subscription as string | null;

        if (!orgId) {
          console.warn("[stripe] checkout.session.completed without org_id metadata");
          break;
        }

        const updates: Record<string, any> = {
          billing_status: "active",
        };

        if (customerId) updates.stripe_customer_id = customerId;
        if (subscriptionId) updates.stripe_subscription_id = subscriptionId;
        if (!updates.plan_id) updates.plan_id = "starter";

        const { error } = await supabaseAdmin
          .from("organizations")
          .update(updates)
          .eq("id", orgId);

        if (error) {
          console.error("[stripe] failed to update organization from checkout:", error);
        } else {
          console.log("[stripe] organization updated from checkout:", orgId);
        }

        break;
      }

      case "customer.subscription.deleted":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string | null;

        if (!customerId) break;

        const billing_status =
          sub.status === "active" || sub.status === "trialing" ? "active" : "cancelled";

        const { error } = await supabaseAdmin
          .from("organizations")
          .update({
            billing_status,
            stripe_subscription_id: sub.id,
          })
          .eq("stripe_customer_id", customerId);

        if (error) {
          console.error("[stripe] failed to sync subscription:", error);
        } else {
          console.log("[stripe] subscription synced to org (customer)", customerId);
        }

        break;
      }

      default:
        // Ignore other events for now
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("[stripe] webhook handler error", err);
    return NextResponse.json(
      { error: err?.message || "Webhook handler error" },
      { status: 500 }
    );
  }
}
