import "server-only";

import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/server";
import { HOSTED_MEMBERSHIP_SETUP_OPERATION } from "./hosted-payment-handoff-contract";
import { reconcileHostedMembershipSetupIntent } from "./reconcile-hosted-payment-setup";

const CHECKOUT_SESSION_ID = /^cs_(?:test|live)_[A-Za-z0-9]+$/;
const BINDING_KEYS = [
  "homeatlas_handoff_id",
  "membership_id",
  "presentation_id",
  "agreement_id",
  "homeowner_id",
  "property_id",
  "billing_terms_hash",
] as const;

function providerId(
  value: string | { id: string } | null,
): string | null {
  return typeof value === "string" ? value : value?.id ?? null;
}

function expandedSetupIntent(
  value: string | Stripe.SetupIntent | null,
): Stripe.SetupIntent | null {
  return value && typeof value !== "string" ? value : null;
}

/**
 * Idempotent fallback for completed hosted setup sessions. Stripe webhooks
 * remain the primary path; this closes the gap when a succeeded event is
 * delayed or was not delivered.
 */
export async function reconcileHostedMembershipCheckoutSession(
  sessionId: string,
): Promise<"processed" | "ignored"> {
  const normalizedSessionId = sessionId.trim();
  if (!CHECKOUT_SESSION_ID.test(normalizedSessionId)) return "ignored";

  const session = await getStripe().checkout.sessions.retrieve(
    normalizedSessionId,
    { expand: ["setup_intent", "setup_intent.payment_method"] },
  );
  const intent = expandedSetupIntent(session.setup_intent);
  if (
    session.mode !== "setup" ||
    session.status !== "complete" ||
    !intent ||
    intent.status !== "succeeded" ||
    session.livemode !== intent.livemode
  ) {
    return "ignored";
  }

  const sessionMetadata = session.metadata ?? {};
  const intentMetadata = intent.metadata ?? {};
  if (
    sessionMetadata.homeatlas_operation !==
      HOSTED_MEMBERSHIP_SETUP_OPERATION ||
    intentMetadata.homeatlas_operation !==
      HOSTED_MEMBERSHIP_SETUP_OPERATION ||
    session.client_reference_id !== sessionMetadata.homeatlas_handoff_id ||
    BINDING_KEYS.some(
      (key) =>
        !sessionMetadata[key] ||
        intentMetadata[key] !== sessionMetadata[key],
    ) ||
    providerId(session.customer) !== providerId(intent.customer)
  ) {
    throw new Error("Hosted Checkout setup binding failed.");
  }

  return reconcileHostedMembershipSetupIntent(intent);
}
