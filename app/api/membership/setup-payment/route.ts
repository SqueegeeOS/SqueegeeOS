import { NextRequest, NextResponse } from "next/server";
import { recordWebsiteMembershipSale } from "@/lib/admin/record-website-membership-sale";
import { resolveMemberEmail } from "@/lib/agreement/resolve-member-email";
import { sendWelcomeEmail } from "@/lib/agreement/send-welcome-email";
import {
  appendPaymentSetupReconciliationEvent,
  loadPaymentSetupContext,
  paymentSetupContextConflict,
  paymentSetupMetadata,
  PaymentSetupInputError,
  readPaymentSetupRequest,
  reconciliationFactKey,
  type PaymentSetupContext,
} from "@/lib/membership/payment-setup-authorization";
import { ensureMembershipObligations } from "@/lib/obligations/ensure-membership-obligations";
import { getPortalAccessUrlForMembership } from "@/lib/persistence/queries/portal-access";
import {
  createServiceRoleSupabaseClient,
  isServiceRoleConfigured,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";
import { isStripeServerEnabled } from "@/lib/stripe/config";
import { resolveStripeKeyMode } from "@/lib/stripe/mode";
import { getStripe } from "@/lib/stripe/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

async function recordMembershipObligations(
  supabase: SupabaseClient,
  activation: LockedActivationResult,
) {
  try {
    const result = await ensureMembershipObligations(supabase, {
      membershipId: activation.membership_id,
      homeownerId: activation.homeowner_id,
      propertyId: activation.property_id,
      visitsPerYear: activation.visits_per_year,
      startedAt: activation.started_at,
    });
    if (result.created > 0) {
      console.info("[setup-payment] obligations generated", {
        membershipId: activation.membership_id,
        created: result.created,
      });
    }
  } catch (error) {
    console.error("[setup-payment] obligation generation failed", error);
  }
}

async function recordWebsiteSale(
  supabase: SupabaseClient,
  activation: LockedActivationResult,
) {
  try {
    const result = await recordWebsiteMembershipSale(supabase, {
      activation,
      activationMode: "stripe",
    });
    if (result.recorded) {
      console.info("[setup-payment] website membership sale recorded", {
        membershipId: activation.membership_id,
        saleId: result.saleId,
      });
    }
  } catch (error) {
    console.error("[setup-payment] website membership sale failed", error);
  }
}

function stripeModeMatches(livemode: boolean): boolean {
  return livemode
    ? resolveStripeKeyMode() === "live"
    : resolveStripeKeyMode() === "test";
}

function stripeId(value: string | { id: string } | null): string | null {
  return typeof value === "string" ? value : value?.id ?? null;
}

function setupIntentConflict(
  setupIntent: Stripe.SetupIntent,
  context: PaymentSetupContext,
): string | null {
  if (!stripeModeMatches(setupIntent.livemode)) return "stripe_mode";
  if (setupIntent.id !== context.membership.stripe_setup_intent_id) {
    return "setup_intent_id";
  }
  if (stripeId(setupIntent.customer) !== context.membership.stripe_customer_id) {
    return "stripe_customer";
  }
  const expected = paymentSetupMetadata(
    context,
    context.reconciliationAttempt!.id,
  );
  for (const [key, value] of Object.entries(expected)) {
    if (setupIntent.metadata?.[key] !== value) return `metadata_${key}`;
  }
  return null;
}

function customerConflict(
  customer: Stripe.Customer,
  context: PaymentSetupContext,
): string | null {
  if (!stripeModeMatches(customer.livemode)) return "stripe_mode";
  const expected = paymentSetupMetadata(
    context,
    context.reconciliationAttempt!.id,
  );
  for (const [key, value] of Object.entries(expected)) {
    if (customer.metadata?.[key] !== value) return `metadata_${key}`;
  }
  return null;
}

async function activateMembership(
  supabase: SupabaseClient,
  context: PaymentSetupContext,
  setupIntentId: string,
  paymentMethodId: string,
  stripeLivemode: boolean,
) {
  const { data, error } = await supabase.rpc(
    "activate_membership_after_stripe_setup",
    {
      p_membership_id: context.membership.id,
      p_presentation_id: context.presentation.id,
      p_agreement_id: context.agreement.id,
      p_homeowner_id: context.homeowner.id,
      p_property_id: context.property.id,
      p_expected_authority_sha256: context.presentation.authority_sha256,
      p_reconciliation_attempt_id: context.reconciliationAttempt!.id,
      p_stripe_customer_id: context.membership.stripe_customer_id,
      p_stripe_setup_intent_id: setupIntentId,
      p_stripe_payment_method_id: paymentMethodId,
      p_stripe_livemode: stripeLivemode,
    },
  );
  if (error || !data) {
    throw new Error(error?.message ?? "Activation transaction returned no result");
  }
  if (
    typeof data === "object" &&
    data !== null &&
    "outcome" in data &&
    data.outcome === "held"
  ) {
    return data as ActivationResult;
  }
  if (!isLockedActivationResult(data)) {
    throw new Error("Activation transaction returned incomplete locked terms");
  }
  return data;
}

interface LockedActivationResult {
  outcome: "activated" | "replay";
  membership_id: string;
  presentation_id: string;
  agreement_id: string;
  homeowner_id: string;
  property_id: string;
  sales_tier: "biannual" | "quarterly";
  visit_price: number;
  visits_per_year: number;
  presentation_authority_sha256: string;
  enrollment_savings: number;
  payment_setup_completed_at: string;
  started_at: string;
}

type ActivationResult =
  | LockedActivationResult
  | { outcome: "held"; reason?: string };

function isLockedActivationResult(value: unknown): value is LockedActivationResult {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    (row.outcome === "activated" || row.outcome === "replay") &&
    [
      "membership_id",
      "presentation_id",
      "agreement_id",
      "homeowner_id",
      "property_id",
      "presentation_authority_sha256",
      "payment_setup_completed_at",
      "started_at",
    ].every((key) => typeof row[key] === "string" && row[key].length > 0) &&
    (row.sales_tier === "biannual" || row.sales_tier === "quarterly") &&
    typeof row.visit_price === "number" &&
    Number.isFinite(row.visit_price) &&
    row.visit_price > 0 &&
    typeof row.visits_per_year === "number" &&
    (row.visits_per_year === 2 || row.visits_per_year === 4) &&
    typeof row.enrollment_savings === "number" &&
    Number.isFinite(row.enrollment_savings) &&
    row.enrollment_savings >= 0
  );
}

function staleCapabilityResponse() {
  return NextResponse.json(
    { error: "Onboarding capability is invalid or stale" },
    { status: 404 },
  );
}

/** Verifies Stripe provider truth, then atomically activates one membership. */
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
    return NextResponse.json(
      { error: "Secure membership persistence is unavailable" },
      { status: 503 },
    );
  }
  if (!isStripeServerEnabled()) {
    return NextResponse.json(
      { error: "Secure card setup is unavailable" },
      { status: 503 },
    );
  }

  let parsed;
  try {
    parsed = await readPaymentSetupRequest(req, {
      requireSetupIntent: true,
    });
  } catch (error) {
    const message =
      error instanceof PaymentSetupInputError
        ? error.message
        : "Request body is invalid";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const supabase = createServiceRoleSupabaseClient();
    const context = await loadPaymentSetupContext(
      supabase,
      parsed.capability,
    );
    if (!context) return staleCapabilityResponse();

    const contextConflict = paymentSetupContextConflict(context, "activate");
    if (contextConflict) {
      console.warn("[setup-payment] authoritative state held", {
        membershipId: context.membership.id,
        reason: contextConflict,
      });
      return NextResponse.json(
        { error: "Membership is not eligible for activation" },
        { status: 409 },
      );
    }

    if (
      !context.membership.stripe_customer_id ||
      !context.membership.stripe_setup_intent_id ||
      context.membership.stripe_setup_intent_id !== parsed.setupIntentId
    ) {
      return NextResponse.json(
        { error: "SetupIntent is not bound to this membership" },
        { status: 409 },
      );
    }

    const stripe = getStripe();
    const setupIntent = await stripe.setupIntents.retrieve(parsed.setupIntentId!);
    if (setupIntent.status !== "succeeded") {
      return NextResponse.json(
        { error: `Card setup is not complete (status: ${setupIntent.status})` },
        { status: 409 },
      );
    }

    const intentConflict = setupIntentConflict(setupIntent, context);
    if (intentConflict) {
      console.warn("[setup-payment] SetupIntent held", {
        membershipId: context.membership.id,
        setupIntentId: setupIntent.id,
        reason: intentConflict,
      });
      return NextResponse.json(
        { error: "SetupIntent does not match this membership" },
        { status: 409 },
      );
    }

    const customer = await stripe.customers.retrieve(
      context.membership.stripe_customer_id,
    );
    if (
      ("deleted" in customer && customer.deleted) ||
      !("livemode" in customer) ||
      customerConflict(customer, context)
    ) {
      console.warn("[setup-payment] Stripe customer held", {
        membershipId: context.membership.id,
        setupIntentId: setupIntent.id,
        reason: "customer_identity_or_metadata_mismatch",
      });
      return NextResponse.json(
        { error: "Stripe customer does not match this membership" },
        { status: 409 },
      );
    }

    const paymentMethodId = stripeId(setupIntent.payment_method);
    if (!paymentMethodId) {
      return NextResponse.json(
        { error: "Stripe did not confirm a payment method" },
        { status: 409 },
      );
    }

    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (
      !stripeModeMatches(paymentMethod.livemode) ||
      stripeId(paymentMethod.customer) !== context.membership.stripe_customer_id
    ) {
      console.warn("[setup-payment] payment method held", {
        membershipId: context.membership.id,
        setupIntentId: setupIntent.id,
        paymentMethodId,
        reason: "payment_method_customer_or_mode_mismatch",
      });
      return NextResponse.json(
        { error: "Payment method is not attached to the expected customer" },
        { status: 409 },
      );
    }

    const activation = await activateMembership(
      supabase,
      context,
      setupIntent.id,
      paymentMethodId,
      setupIntent.livemode,
    );
    if (activation.outcome === "held") {
      const reason = activation.reason ?? "activation_held";
      await appendPaymentSetupReconciliationEvent(supabase, {
        attemptId: context.reconciliationAttempt!.id,
        eventKey: reconciliationFactKey("activation_held", reason),
        phase: "activation",
        status: "held",
        stripeCustomerId: context.membership.stripe_customer_id,
        stripeSetupIntentId: setupIntent.id,
        outcome: "held",
        errorCode: reason,
      });
      console.warn("[setup-payment] transaction held", {
        membershipId: context.membership.id,
        setupIntentId: setupIntent.id,
        reason: activation.reason ?? "missing_completion_evidence",
      });
      return NextResponse.json(
        { error: "Membership changed before activation could complete" },
        { status: 409 },
      );
    }

    await appendPaymentSetupReconciliationEvent(supabase, {
      attemptId: context.reconciliationAttempt!.id,
      eventKey:
        activation.outcome === "activated"
          ? "activation_completed"
          : "activation_replay_observed",
      phase: "activation",
      status: activation.outcome === "activated" ? "activated" : "replayed",
      stripeCustomerId: context.membership.stripe_customer_id,
      stripeSetupIntentId: setupIntent.id,
      outcome: activation.outcome,
    });

    const paymentSetupCompletedAt = activation.payment_setup_completed_at;
    await recordMembershipObligations(supabase, activation);
    await recordWebsiteSale(supabase, activation);

    const portalUrl = await getPortalAccessUrlForMembership(
      activation.membership_id,
      req.nextUrl.origin,
    );

    if (activation.outcome === "activated" && portalUrl) {
      const memberEmail = resolveMemberEmail(context.homeowner.email);
      if (memberEmail) {
        const welcomeEmail = await sendWelcomeEmail({
          to: memberEmail,
          name: context.homeowner.full_name.trim() || "Member",
          portalUrl,
        });
        if (welcomeEmail.status !== "sent") {
          console.warn("[setup-payment] welcome email not sent", welcomeEmail);
        }
      }
    }

    return NextResponse.json({
      status: "active",
      onboardingStatus: "complete",
      paymentSetupCompletedAt,
      mode: "stripe",
      alreadyActive: activation.outcome === "replay",
      portalUrl,
    });
  } catch (error) {
    console.error("[setup-payment] failed", error);
    return NextResponse.json(
      {
        error: "Unable to verify and activate card setup",
        recovery:
          "Retry with the same onboarding capability and confirmed SetupIntent.",
      },
      { status: 500 },
    );
  }
}
