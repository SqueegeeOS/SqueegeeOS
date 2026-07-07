import Stripe from "stripe";
import { isStripeServerEnabled } from "./config";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!isStripeServerEnabled()) {
    throw new Error(
      "Stripe is not configured. Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY and STRIPE_SECRET_KEY.",
    );
  }

  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!.trim());
  }

  return stripeClient;
}
