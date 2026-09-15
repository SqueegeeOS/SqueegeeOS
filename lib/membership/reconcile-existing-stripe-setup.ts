import "server-only";

import type Stripe from "stripe";
import { reconcileEnrollmentSetupIntent } from "@/lib/enrollment/reconcile-stripe-setup";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { getStripe } from "@/lib/stripe/server";
import { HOSTED_MEMBERSHIP_SETUP_OPERATION } from "./hosted-payment-handoff-contract";
import { reconcileHostedMembershipSetupIntent } from "./reconcile-hosted-payment-setup";

const ENROLLMENT_SETUP_OPERATION = "membership_enrollment_setup";

export interface ExistingStripeSetupReconciliation {
  setupIntentId: string;
  operation:
    | typeof ENROLLMENT_SETUP_OPERATION
    | typeof HOSTED_MEMBERSHIP_SETUP_OPERATION;
}

function belongsToMembership(intent: Stripe.SetupIntent, membershipId: string) {
  return intent.metadata?.membership_id?.trim() === membershipId;
}

/**
 * Recovers a completed Stripe card setup when its success webhook was missed.
 * Returns null when Stripe has no completed setup for this membership.
 */
export async function reconcileExistingStripeSetup(
  membershipId: string,
): Promise<ExistingStripeSetupReconciliation | null> {
  const supabase = createServiceRoleSupabaseClient();
  const result = await supabase
    .from("memberships")
    .select("id, status, stripe_customer_id, stripe_payment_method_id, payment_setup_completed_at")
    .eq("id", membershipId)
    .maybeSingle();
  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("Membership not found.");
  if (
    result.data.status !== "pending_payment" ||
    result.data.stripe_payment_method_id ||
    result.data.payment_setup_completed_at
  ) {
    return null;
  }

  const customerId = result.data.stripe_customer_id?.trim();
  if (!customerId) return null;

  const intents = await getStripe().setupIntents.list({
    customer: customerId,
    limit: 25,
  });
  const intent = intents.data.find(
    (candidate) =>
      candidate.status === "succeeded" &&
      belongsToMembership(candidate, membershipId) &&
      (candidate.metadata?.homeatlas_operation === ENROLLMENT_SETUP_OPERATION ||
        candidate.metadata?.homeatlas_operation ===
          HOSTED_MEMBERSHIP_SETUP_OPERATION),
  );
  if (!intent) return null;

  const operation = intent.metadata?.homeatlas_operation as
    | typeof ENROLLMENT_SETUP_OPERATION
    | typeof HOSTED_MEMBERSHIP_SETUP_OPERATION;
  const outcome =
    operation === HOSTED_MEMBERSHIP_SETUP_OPERATION
      ? await reconcileHostedMembershipSetupIntent(intent)
      : await reconcileEnrollmentSetupIntent(intent);
  if (outcome !== "processed") {
    throw new Error("Stripe card setup could not be reconciled.");
  }
  return { setupIntentId: intent.id, operation };
}
