import Stripe from "stripe";

// Pin to the latest monthly Clover release
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-10-29.clover",
});

export type StripeClient = Stripe; // avoid literal version generics
