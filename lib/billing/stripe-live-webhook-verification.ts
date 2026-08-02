import "server-only";

import { randomUUID } from "node:crypto";
import { isStripeLiveMode } from "@/lib/stripe/mode";
import { getStripe } from "@/lib/stripe/server";

export interface StripeLiveWebhookVerificationRequest {
  setupIntentId: string;
  livemode: true;
}

/**
 * Creates and immediately cancels a live SetupIntent. A SetupIntent cannot
 * move money, but its signed `setup_intent.created` event proves that the
 * currently deployed live webhook endpoint and secret agree.
 */
export async function requestStripeLiveWebhookVerification(): Promise<StripeLiveWebhookVerificationRequest> {
  if (!isStripeLiveMode()) {
    throw new Error(
      "Live Stripe publishable and secret keys are required before webhook verification.",
    );
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET?.trim()) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET is required before webhook verification.",
    );
  }

  const stripe = getStripe();
  const setupIntent = await stripe.setupIntents.create(
    {
      usage: "off_session",
      payment_method_types: ["card"],
      metadata: {
        homeatlas_operation: "live_webhook_verification",
        homeatlas_actor: "hq_founder",
      },
    },
    {
      idempotencyKey: `homeatlas-live-webhook-verification:${randomUUID()}`,
    },
  );

  if (!setupIntent.livemode) {
    throw new Error(
      "Stripe returned a test-mode SetupIntent; live webhook verification was not accepted.",
    );
  }

  // No customer or payment method is attached, and a SetupIntent never
  // creates a charge. Cancel it immediately so the verification object cannot
  // be reused for a later card setup either.
  await stripe.setupIntents.cancel(setupIntent.id);

  return { setupIntentId: setupIntent.id, livemode: true };
}
