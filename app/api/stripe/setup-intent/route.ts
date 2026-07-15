import { NextRequest, NextResponse } from "next/server";
import { resolveMemberEmail } from "@/lib/agreement/resolve-member-email";
import {
  appendPaymentSetupReconciliationEvent,
  capabilityAuditKind,
  loadPaymentSetupContext,
  paymentSetupContextConflict,
  paymentSetupMetadata,
  PaymentSetupInputError,
  readPaymentSetupRequest,
  reconciliationFactKey,
  reservePaymentSetupReconciliation,
  type PaymentSetupContext,
  type PaymentSetupReconciliationAttempt,
} from "@/lib/membership/payment-setup-authorization";
import {
  createServiceRoleSupabaseClient,
  isServiceRoleConfigured,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";
import { isStripeServerEnabled } from "@/lib/stripe/config";
import { resolveStripeKeyMode } from "@/lib/stripe/mode";
import { getStripe } from "@/lib/stripe/server";
import type Stripe from "stripe";

const REUSABLE_SETUP_STATUSES = new Set<Stripe.SetupIntent.Status>([
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
]);

function stripeModeMatches(livemode: boolean): boolean {
  return livemode
    ? resolveStripeKeyMode() === "live"
    : resolveStripeKeyMode() === "test";
}

function stripeId(value: string | { id: string } | null): string | null {
  return typeof value === "string" ? value : value?.id ?? null;
}

function customerBindingConflict(
  customer: Stripe.Customer,
  expected: ReturnType<typeof paymentSetupMetadata>,
): string | null {
  for (const [key, value] of Object.entries(expected)) {
    const observed = customer.metadata?.[key];
    if (observed !== value) return observed ? key : `missing_${key}`;
  }
  return null;
}

function setupIntentConflict(
  setupIntent: Stripe.SetupIntent,
  customerId: string,
  expected: ReturnType<typeof paymentSetupMetadata>,
): string | null {
  if (!stripeModeMatches(setupIntent.livemode)) return "stripe_mode";
  if (stripeId(setupIntent.customer) !== customerId) return "stripe_customer";
  for (const [key, value] of Object.entries(expected)) {
    if (setupIntent.metadata?.[key] !== value) return `metadata_${key}`;
  }
  return null;
}

async function claimStripeSetup(
  supabase: ReturnType<typeof createServiceRoleSupabaseClient>,
  context: PaymentSetupContext,
  reconciliationAttemptId: string,
  customerId: string,
  setupIntentId: string | null,
) {
  const { data, error } = await supabase.rpc("claim_membership_stripe_setup", {
    p_membership_id: context.membership.id,
    p_presentation_id: context.presentation.id,
    p_agreement_id: context.agreement.id,
    p_homeowner_id: context.homeowner.id,
    p_property_id: context.property.id,
    p_expected_authority_sha256: context.presentation.authority_sha256,
    p_reconciliation_attempt_id: reconciliationAttemptId,
    p_stripe_customer_id: customerId,
    p_stripe_setup_intent_id: setupIntentId,
  });
  if (error || !data) {
    throw new Error(error?.message ?? "Stripe setup claim returned no result");
  }
  return data as { outcome: "claimed" | "held"; reason?: string };
}

function staleCapabilityResponse() {
  return NextResponse.json(
    { error: "Onboarding capability is invalid or stale" },
    { status: 404 },
  );
}

/** Creates or reuses the one SetupIntent bound to a signed pending membership. */
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
      requireSetupIntent: false,
    });
  } catch (error) {
    const message =
      error instanceof PaymentSetupInputError
        ? error.message
        : "Request body is invalid";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = createServiceRoleSupabaseClient();
  let reconciliation: PaymentSetupReconciliationAttempt | null = null;
  let reconciledCustomerId: string | null = null;
  let reconciledSetupIntentId: string | null = null;
  let failurePhase: "customer" | "setup_intent" | "claim" = "customer";
  let failureCode = "provider_reconciliation_failed";

  try {
    const context = await loadPaymentSetupContext(
      supabase,
      parsed.capability,
    );
    if (!context) return staleCapabilityResponse();

    const contextConflict = paymentSetupContextConflict(context, "create");
    if (contextConflict) {
      console.warn("[stripe/setup-intent] held", {
        membershipId: context.membership.id,
        reason: contextConflict,
      });
      return NextResponse.json(
        { error: "Membership is not eligible for card setup" },
        { status: 409 },
      );
    }

    const reservation = await reservePaymentSetupReconciliation(
      supabase,
      context,
      capabilityAuditKind(parsed.capability),
    );
    if ("outcome" in reservation) {
      return NextResponse.json(
        { error: "Membership changed before provider setup could start" },
        { status: 409 },
      );
    }
    reconciliation = reservation;

    const stripe = getStripe();
    const metadata = paymentSetupMetadata(context, reconciliation.id);
    const email = resolveMemberEmail(context.homeowner.email);
    const name = context.homeowner.full_name.trim();
    let customerId = context.membership.stripe_customer_id;
    const customerWasBound = Boolean(customerId);

    if (customerId) {
      failureCode = "stripe_customer_retrieval_failed";
      const existing = await stripe.customers.retrieve(customerId);
      if (
        ("deleted" in existing && existing.deleted) ||
        !("livemode" in existing) ||
        !stripeModeMatches(existing.livemode)
      ) {
        return NextResponse.json(
          { error: "Stored Stripe customer requires reconciliation" },
          { status: 409 },
        );
      }
      const bindingConflict = customerBindingConflict(existing, metadata);
      if (bindingConflict) {
        console.warn("[stripe/setup-intent] customer metadata held", {
          membershipId: context.membership.id,
          field: bindingConflict,
        });
        return NextResponse.json(
          { error: "Stored Stripe customer requires reconciliation" },
          { status: 409 },
        );
      }
    } else {
      failureCode = "stripe_customer_creation_failed";
      const created = await stripe.customers.create(
        {
          name: name || undefined,
          email: email ?? undefined,
          metadata,
        },
        {
          idempotencyKey: reconciliation.customer_idempotency_key,
        },
      );
      reconciledCustomerId = created.id;
      if (!stripeModeMatches(created.livemode)) {
        throw new Error("Stripe customer mode does not match configured keys");
      }
      customerId = created.id;
    }
    reconciledCustomerId = customerId;
    failureCode = "customer_reconciliation_write_failed";
    await appendPaymentSetupReconciliationEvent(supabase, {
      attemptId: reconciliation.id,
      eventKey: customerWasBound ? "customer_observed" : "customer_created",
      phase: "customer",
      status: customerWasBound ? "observed" : "created",
      stripeCustomerId: customerId,
      outcome: "provider_resolved",
    });

    failurePhase = "claim";
    failureCode = "customer_claim_failed";
    const customerClaim = await claimStripeSetup(
      supabase,
      context,
      reconciliation.id,
      customerId,
      null,
    );
    if (customerClaim.outcome !== "claimed") {
      const reason = customerClaim.reason ?? "customer_claim_held";
      await appendPaymentSetupReconciliationEvent(supabase, {
        attemptId: reconciliation.id,
        eventKey: reconciliationFactKey("customer_claim_held", reason),
        phase: "claim",
        status: "held",
        stripeCustomerId: customerId,
        outcome: "held",
        errorCode: reason,
      });
      console.warn("[stripe/setup-intent] customer claim held", {
        membershipId: context.membership.id,
        reason: customerClaim.reason,
      });
      return NextResponse.json(
        { error: "Membership changed while card setup was starting" },
        { status: 409 },
      );
    }
    await appendPaymentSetupReconciliationEvent(supabase, {
      attemptId: reconciliation.id,
      eventKey: "customer_claimed",
      phase: "claim",
      status: "claimed",
      stripeCustomerId: customerId,
      outcome: "claimed",
    });

    let setupIntent: Stripe.SetupIntent;
    failurePhase = "setup_intent";
    const setupIntentWasBound = Boolean(
      context.membership.stripe_setup_intent_id,
    );
    if (context.membership.stripe_setup_intent_id) {
      failureCode = "stripe_setup_intent_retrieval_failed";
      setupIntent = await stripe.setupIntents.retrieve(
        context.membership.stripe_setup_intent_id,
      );
    } else {
      failureCode = "stripe_setup_intent_creation_failed";
      setupIntent = await stripe.setupIntents.create(
        {
          customer: customerId,
          payment_method_types: ["card"],
          usage: "off_session",
          metadata,
        },
        {
          idempotencyKey: reconciliation.setup_intent_idempotency_key,
        },
      );
    }
    reconciledSetupIntentId = setupIntent.id;
    failureCode = "setup_intent_reconciliation_write_failed";
    await appendPaymentSetupReconciliationEvent(supabase, {
      attemptId: reconciliation.id,
      eventKey: setupIntentWasBound
        ? "setup_intent_observed"
        : "setup_intent_created",
      phase: "setup_intent",
      status: setupIntentWasBound ? "observed" : "created",
      stripeCustomerId: customerId,
      stripeSetupIntentId: setupIntent.id,
      outcome: "provider_resolved",
    });

    const intentConflict = setupIntentConflict(
      setupIntent,
      customerId,
      metadata,
    );
    if (intentConflict) {
      console.warn("[stripe/setup-intent] intent held", {
        membershipId: context.membership.id,
        setupIntentId: setupIntent.id,
        reason: intentConflict,
      });
      return NextResponse.json(
        { error: "Stripe setup does not match this membership" },
        { status: 409 },
      );
    }

    failurePhase = "claim";
    failureCode = "setup_intent_claim_failed";
    const intentClaim = await claimStripeSetup(
      supabase,
      context,
      reconciliation.id,
      customerId,
      setupIntent.id,
    );
    if (intentClaim.outcome !== "claimed") {
      const reason = intentClaim.reason ?? "setup_intent_claim_held";
      await appendPaymentSetupReconciliationEvent(supabase, {
        attemptId: reconciliation.id,
        eventKey: reconciliationFactKey("setup_intent_claim_held", reason),
        phase: "claim",
        status: "held",
        stripeCustomerId: customerId,
        stripeSetupIntentId: setupIntent.id,
        outcome: "held",
        errorCode: reason,
      });
      console.warn("[stripe/setup-intent] intent claim held", {
        membershipId: context.membership.id,
        setupIntentId: setupIntent.id,
        reason: intentClaim.reason,
      });
      return NextResponse.json(
        { error: "Membership changed while card setup was starting" },
        { status: 409 },
      );
    }
    await appendPaymentSetupReconciliationEvent(supabase, {
      attemptId: reconciliation.id,
      eventKey: "setup_intent_claimed",
      phase: "claim",
      status: "claimed",
      stripeCustomerId: customerId,
      stripeSetupIntentId: setupIntent.id,
      outcome: "claimed",
    });

    if (
      !REUSABLE_SETUP_STATUSES.has(setupIntent.status) ||
      !setupIntent.client_secret
    ) {
      return NextResponse.json(
        {
          error:
            setupIntent.status === "succeeded"
              ? "Card setup is already confirmed and awaiting activation"
              : "Stripe setup is not in a reusable state",
        },
        { status: 409 },
      );
    }

    failureCode = "ready_reconciliation_write_failed";
    await appendPaymentSetupReconciliationEvent(supabase, {
      attemptId: reconciliation.id,
      eventKey: "ready_for_confirmation",
      phase: "claim",
      status: "ready",
      stripeCustomerId: customerId,
      stripeSetupIntentId: setupIntent.id,
      outcome: "ready",
    });

    return NextResponse.json({ clientSecret: setupIntent.client_secret });
  } catch (error) {
    if (reconciliation) {
      const failureDetail = [
        failurePhase,
        failureCode,
        reconciledCustomerId ?? "none",
        reconciledSetupIntentId ?? "none",
      ].join(":");
      await appendPaymentSetupReconciliationEvent(supabase, {
        attemptId: reconciliation.id,
        eventKey: reconciliationFactKey("failure", failureDetail),
        phase: failurePhase,
        status: "failed",
        stripeCustomerId: reconciledCustomerId,
        stripeSetupIntentId: reconciledSetupIntentId,
        outcome: "failed",
        errorCode: failureCode,
      }).catch((reconciliationError) => {
        console.error(
          "[stripe/setup-intent] reconciliation failure could not be appended",
          reconciliationError,
        );
      });
    }
    console.error("[stripe/setup-intent] failed", error);
    return NextResponse.json(
      { error: "Unable to start secure card setup" },
      { status: 500 },
    );
  }
}
