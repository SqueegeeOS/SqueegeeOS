import "server-only";

import type Stripe from "stripe";
import { recordWebsiteMembershipSale } from "@/lib/admin/record-website-membership-sale";
import { ensureMembershipObligations } from "@/lib/obligations/ensure-membership-obligations";
import {
  buildInitialWelcomeIdempotencyKey,
  sendMembershipWelcomeEmail,
} from "@/lib/membership/send-membership-welcome-email";
import { persistMembershipEnrollmentSavings } from "@/lib/membership/persist-membership-enrollment-savings";
import { loadMembershipForPayment } from "@/lib/membership/load-membership-for-payment";
import { getPortalAccessUrlForMembership } from "@/lib/persistence/queries/portal-access";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { syncMembershipSalesAttributionLifecycle } from "@/lib/sales/attribution-lifecycle-server";
import { recordSignedMembershipAttribution } from "@/lib/sales/signed-attribution-server";
import { isStripeLiveMode } from "@/lib/stripe/mode";
import { getStripe } from "@/lib/stripe/server";
import {
  HOSTED_MEMBERSHIP_SETUP_OPERATION,
  hostedMembershipSetupBindingIssues,
} from "./hosted-payment-handoff-contract";

type RepairStep =
  | "obligations"
  | "website_sale"
  | "enrollment_savings"
  | "presentation_status"
  | "sales_attribution"
  | "welcome_email";

interface HandoffRow {
  id: string;
  membership_id: string;
  presentation_id: string;
  agreement_id: string;
  homeowner_id: string;
  property_id: string;
  billing_terms_hash: string;
  status: string;
  stripe_customer_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_setup_intent_id: string | null;
  stripe_payment_method_id: string | null;
  stripe_livemode: boolean | null;
}

function providerId(value: string | { id: string } | null): string | null {
  return typeof value === "string" ? value : value?.id ?? null;
}

async function finishActivation(input: {
  membershipId: string;
  paymentCompletedAt: string;
  portalUrl: string | null;
}): Promise<RepairStep[]> {
  const supabase = createServiceRoleSupabaseClient();
  const membership = await loadMembershipForPayment(supabase, {
    membershipId: input.membershipId,
  });
  if (!membership) throw new Error("Activated hosted-setup membership was not found.");
  const repair: RepairStep[] = [];

  try {
    await ensureMembershipObligations(supabase, {
      membershipId: membership.id,
      homeownerId: membership.homeowner_id,
      propertyId: membership.property_id,
      visitsPerYear: membership.visits_per_year,
      startedAt: membership.started_at ?? input.paymentCompletedAt,
    });
  } catch (error) {
    repair.push("obligations");
    console.error("[hosted-payment-setup] obligations repair required", error);
  }
  try {
    await recordWebsiteMembershipSale(supabase, {
      membershipId: membership.id,
      paymentSetupCompletedAt: input.paymentCompletedAt,
      soldAt: input.paymentCompletedAt,
      activationMode: "stripe",
    });
  } catch (error) {
    repair.push("website_sale");
    console.error("[hosted-payment-setup] website sale repair required", error);
  }
  try {
    await persistMembershipEnrollmentSavings(
      supabase,
      membership.id,
      membership.presentation_id,
    );
  } catch (error) {
    repair.push("enrollment_savings");
    console.error("[hosted-payment-setup] savings repair required", error);
  }
  try {
    if (membership.presentation_id) {
      await recordSignedMembershipAttribution({
        presentationId: membership.presentation_id,
        membershipId: membership.id,
        agreementId: membership.agreement_id,
        signedAt: membership.started_at,
      });
    }
    await syncMembershipSalesAttributionLifecycle({
      supabase,
      membershipId: membership.id,
    });
  } catch (error) {
    repair.push("sales_attribution");
    console.error("[hosted-payment-setup] attribution repair required", error);
  }
  if (membership.presentation_id) {
    const presentation = await supabase
      .from("presentations")
      .update({ onboarding_status: "complete" })
      .eq("id", membership.presentation_id);
    if (presentation.error) repair.push("presentation_status");
  }
  const welcome = await sendMembershipWelcomeEmail(supabase, {
    membershipId: membership.id,
    homeownerId: membership.homeowner_id,
    presentationId: membership.presentation_id,
    portalUrl: input.portalUrl,
    idempotencyKey: buildInitialWelcomeIdempotencyKey(
      membership.id,
      input.paymentCompletedAt,
    ),
  });
  if (welcome.status !== "sent" && welcome.reason !== "already_sent") {
    repair.push("welcome_email");
  }
  return [...new Set(repair)];
}

export async function reconcileHostedMembershipSetupIntent(
  intent: Stripe.SetupIntent,
): Promise<"processed" | "ignored"> {
  const metadata = intent.metadata ?? {};
  if (
    metadata.homeatlas_operation !== HOSTED_MEMBERSHIP_SETUP_OPERATION ||
    intent.status !== "succeeded"
  ) {
    return "ignored";
  }
  const handoffId = metadata.homeatlas_handoff_id?.trim();
  if (!handoffId) {
    throw new Error("Hosted SetupIntent is missing its handoff binding.");
  }

  const supabase = createServiceRoleSupabaseClient();
  const handoffResult = await supabase
    .from("membership_payment_handoffs")
    .select("*")
    .eq("id", handoffId)
    .maybeSingle();
  if (handoffResult.error) throw new Error(handoffResult.error.message);
  if (!handoffResult.data) throw new Error("Hosted payment handoff not found.");
  const handoff = handoffResult.data as HandoffRow;
  const expectedBinding = {
    handoffId: handoff.id,
    membershipId: handoff.membership_id,
    presentationId: handoff.presentation_id,
    agreementId: handoff.agreement_id,
    homeownerId: handoff.homeowner_id,
    propertyId: handoff.property_id,
    billingTermsHash: handoff.billing_terms_hash,
  };
  const issues = hostedMembershipSetupBindingIssues(metadata, expectedBinding);
  if (!handoff.stripe_checkout_session_id) issues.push("checkout_session_missing");
  if (handoff.stripe_livemode !== intent.livemode) issues.push("stripe_mode_mismatch");
  if (intent.livemode !== isStripeLiveMode()) issues.push("server_mode_mismatch");
  const paymentMethodId = providerId(
    intent.payment_method as string | { id: string } | null,
  );
  const customerId = providerId(intent.customer as string | { id: string } | null);
  if (!paymentMethodId) issues.push("payment_method_missing");
  if (!customerId) issues.push("stripe_customer_missing");

  const [membership, agreementResult] = await Promise.all([
    loadMembershipForPayment(supabase, { membershipId: handoff.membership_id }),
    supabase
      .from("signed_agreements")
      .select(
        "id, membership_id, homeowner_id, property_id, status, billing_authorized_at, billing_terms_hash",
      )
      .eq("id", handoff.agreement_id)
      .maybeSingle(),
  ]);
  if (agreementResult.error) throw new Error(agreementResult.error.message);
  const agreement = agreementResult.data;
  if (!membership) issues.push("membership_missing");
  if (!agreement) issues.push("agreement_missing");
  if (membership) {
    if (membership.payment_rail !== "stripe_card") {
      issues.push("membership_payment_rail_not_stripe");
    }
    if (membership.presentation_id !== handoff.presentation_id) {
      issues.push("membership_presentation_mismatch");
    }
    if (membership.agreement_id !== handoff.agreement_id) {
      issues.push("membership_agreement_mismatch");
    }
    if (membership.homeowner_id !== handoff.homeowner_id) {
      issues.push("membership_homeowner_mismatch");
    }
    if (membership.property_id !== handoff.property_id) {
      issues.push("membership_property_mismatch");
    }
    if (
      membership.stripe_customer_id &&
      customerId &&
      membership.stripe_customer_id !== customerId
    ) {
      issues.push("membership_stripe_customer_mismatch");
    }
  }
  if (handoff.stripe_customer_id && customerId && handoff.stripe_customer_id !== customerId) {
    issues.push("handoff_stripe_customer_mismatch");
  }
  if (agreement) {
    if (
      agreement.id !== handoff.agreement_id ||
      agreement.membership_id !== handoff.membership_id ||
      agreement.homeowner_id !== handoff.homeowner_id ||
      agreement.property_id !== handoff.property_id
    ) {
      issues.push("signed_agreement_binding_mismatch");
    }
    if (
      agreement.status !== "complete" ||
      !agreement.billing_authorized_at ||
      agreement.billing_terms_hash !== handoff.billing_terms_hash
    ) {
      issues.push("signed_billing_authority_mismatch");
    }
  }
  if (issues.length > 0 || !membership || !agreement || !paymentMethodId || !customerId) {
    const attention = await supabase
      .from("membership_payment_handoffs")
      .update({
        status: "needs_attention",
        last_error_code: "stripe_binding_mismatch",
        last_error_message: `Stripe setup binding failed: ${issues.join(", ")}`,
      })
      .eq("id", handoff.id);
    if (attention.error) throw new Error(attention.error.message);
    throw new Error(`Hosted SetupIntent binding failed: ${issues.join(", ")}`);
  }

  if (
    handoff.status === "completed" &&
    handoff.stripe_setup_intent_id === intent.id &&
    handoff.stripe_payment_method_id === paymentMethodId
  ) {
    return "processed";
  }

  await getStripe().customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });
  const now = new Date().toISOString();
  const activation = await supabase
    .from("memberships")
    .update({
      status: "active",
      payment_setup_completed_at: membership.payment_setup_completed_at ?? now,
      started_at: membership.started_at ?? now,
      stripe_customer_id: customerId,
      stripe_payment_method_id: paymentMethodId,
    })
    .eq("id", membership.id)
    .is("payment_setup_completed_at", null)
    .select("id");
  if (activation.error) throw new Error(activation.error.message);
  if ((activation.data?.length ?? 0) === 0 && !membership.payment_setup_completed_at) {
    const reloaded = await loadMembershipForPayment(supabase, {
      membershipId: membership.id,
    });
    if (
      !reloaded?.payment_setup_completed_at ||
      reloaded.stripe_customer_id !== customerId ||
      reloaded.stripe_payment_method_id !== paymentMethodId
    ) {
      throw new Error("Concurrent membership activation did not converge.");
    }
  }
  const paymentCompletedAt = membership.payment_setup_completed_at ?? now;
  const portalUrl = await getPortalAccessUrlForMembership(membership.id);
  const repairNeeded = await finishActivation({
    membershipId: membership.id,
    paymentCompletedAt,
    portalUrl,
  });
  const completed = await supabase
    .from("membership_payment_handoffs")
    .update({
      status: "completed",
      stripe_customer_id: customerId,
      stripe_setup_intent_id: intent.id,
      stripe_payment_method_id: paymentMethodId,
      completed_at: paymentCompletedAt,
      last_error_code:
        repairNeeded.length > 0 ? "activation_repairs_required" : null,
      last_error_message:
        repairNeeded.length > 0
          ? `Non-blocking activation repairs: ${repairNeeded.join(", ")}`
          : null,
    })
    .eq("id", handoff.id);
  if (completed.error) throw new Error(completed.error.message);
  const event = await supabase.from("membership_payment_handoff_events").insert({
    handoff_id: handoff.id,
    event_type: "payment_setup_completed",
    actor: "stripe_verified_setup",
    provider: "stripe",
    provider_event_key: `setup-intent:${intent.id}:succeeded`,
    event_data: {
      setupIntentId: intent.id,
      membershipId: membership.id,
      paymentCompletedAt,
      repairNeeded,
    },
  });
  if (event.error && event.error.code !== "23505") {
    throw new Error(event.error.message);
  }
  return "processed";
}
