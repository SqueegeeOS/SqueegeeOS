import "server-only";

import { createHash } from "node:crypto";
import Stripe from "stripe";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { isStripeLiveMode } from "@/lib/stripe/mode";
import { notifyAutomaticBillingResult } from "./automatic-billing-notifications";
import { recordBillingReconciliationCase } from "./reconciliation";
import {
  billingPaymentIntentBindingIssues,
  stripePaymentIntentReference,
} from "./stripe-payment-intent-binding";

export type StripeBillingWebhookResult =
  | { status: "processed"; billingOrderId: string }
  | { status: "duplicate" | "ignored"; billingOrderId: string | null };

interface WebhookOrderRow {
  id: string;
  membership_id: string;
  property_id: string;
  appointment_id: string;
  service_month: string;
  scheduled_service_at: string;
  expected_charge_cents: number;
  execution_state: string;
  attempt_count: number;
  stripe_payment_intent_id: string | null;
}

interface WebhookMembershipRow {
  id: string;
  homeowner_id: string;
  stripe_customer_id: string | null;
}

interface WebhookHomeownerRow {
  id: string;
  first_name: string | null;
}

function finalizedExecutionState(data: unknown): string | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const value = (row as { execution_state?: unknown }).execution_state;
  return typeof value === "string" ? value : null;
}

function eventObjectId(event: Stripe.Event): string | null {
  const object = event.data.object as { id?: unknown };
  return typeof object.id === "string" ? object.id : null;
}

function paymentIntentFromEvent(event: Stripe.Event): Stripe.PaymentIntent | null {
  return event.data.object.object === "payment_intent"
    ? (event.data.object as Stripe.PaymentIntent)
    : null;
}

async function loadWebhookContext(billingOrderId: string): Promise<{
  order: WebhookOrderRow;
  membership: WebhookMembershipRow;
  homeowner: WebhookHomeownerRow;
} | null> {
  const supabase = createServiceRoleSupabaseClient();
  const orderResult = await supabase
    .from("billing_orders")
    .select(
      "id, membership_id, property_id, appointment_id, service_month, scheduled_service_at, expected_charge_cents, execution_state, attempt_count, stripe_payment_intent_id",
    )
    .eq("id", billingOrderId)
    .maybeSingle();
  if (orderResult.error) throw new Error(orderResult.error.message);
  if (!orderResult.data) return null;
  const order = orderResult.data as WebhookOrderRow;
  const membershipResult = await supabase
    .from("memberships")
    .select("id, homeowner_id, stripe_customer_id")
    .eq("id", order.membership_id)
    .maybeSingle();
  if (membershipResult.error) throw new Error(membershipResult.error.message);
  if (!membershipResult.data) return null;
  const membership = membershipResult.data as WebhookMembershipRow;
  const homeownerResult = await supabase
    .from("homeowners")
    .select("id, first_name")
    .eq("id", membership.homeowner_id)
    .maybeSingle();
  if (homeownerResult.error) throw new Error(homeownerResult.error.message);
  if (!homeownerResult.data) return null;
  return {
    order,
    membership,
    homeowner: homeownerResult.data as WebhookHomeownerRow,
  };
}

function eventIntentStatusIssues(
  event: Stripe.Event,
  intent: Stripe.PaymentIntent,
): string[] {
  if (
    event.type === "payment_intent.succeeded" &&
    intent.status !== "succeeded"
  ) {
    return ["stripe_succeeded_event_status_mismatch"];
  }
  if (
    event.type === "payment_intent.requires_action" &&
    intent.status !== "requires_action"
  ) {
    return ["stripe_requires_action_event_status_mismatch"];
  }
  if (
    event.type === "payment_intent.payment_failed" &&
    !["requires_payment_method", "requires_action", "canceled"].includes(
      intent.status,
    )
  ) {
    return ["stripe_failed_event_status_mismatch"];
  }
  return [];
}

async function validateWebhookBinding(input: {
  event: Stripe.Event;
  intent: Stripe.PaymentIntent;
  order: WebhookOrderRow;
  membership: WebhookMembershipRow;
}): Promise<boolean> {
  const issues: string[] = input.membership.stripe_customer_id
    ? billingPaymentIntentBindingIssues(input.intent, {
        billingOrderId: input.order.id,
        membershipId: input.order.membership_id,
        propertyId: input.order.property_id,
        appointmentId: input.order.appointment_id,
        serviceMonth: input.order.service_month,
        expectedChargeCents: input.order.expected_charge_cents,
        stripeCustomerId: input.membership.stripe_customer_id,
        stripePaymentIntentId: input.order.stripe_payment_intent_id,
        livemode: isStripeLiveMode(),
      })
    : ["stripe_customer_missing"];
  issues.push(...eventIntentStatusIssues(input.event, input.intent));
  if (input.event.livemode !== input.intent.livemode) {
    issues.push("stripe_event_mode_mismatch");
  }
  if (input.order.attempt_count < 1) {
    issues.push("billing_attempt_missing");
  }
  if (issues.length === 0) return true;

  await recordBillingReconciliationCase({
    billingOrderId: input.order.id,
    stripeObjectId: input.intent.id,
    discrepancyType: issues.some((issue) => issue.includes("amount"))
      ? "amount_mismatch"
      : "status_mismatch",
    evidence: {
      source: "stripe_webhook_binding_gate",
      event_id: input.event.id,
      event_type: input.event.type,
      issues,
    },
  });
  const supabase = createServiceRoleSupabaseClient();
  const finalized = await supabase.rpc("finalize_billing_attempt_failure", {
    p_order_id: input.order.id,
    p_attempt_number: input.order.attempt_count,
    p_outcome: "reconciliation_required",
    p_intent_id: issues.includes("payment_intent_id_mismatch")
      ? input.order.stripe_payment_intent_id
      : input.intent.id,
    p_next_attempt_at: null,
    p_failure_code: "stripe_webhook_binding_mismatch",
    p_failure_message: `Stripe webhook binding failed: ${issues.join(", ")}`,
    p_completed_at: new Date().toISOString(),
  });
  if (finalized.error) throw new Error(finalized.error.message);
  return false;
}

async function reconcileSucceededPaymentIntent(input: {
  intent: Stripe.PaymentIntent;
  order: WebhookOrderRow;
  membership: WebhookMembershipRow;
  homeowner: WebhookHomeownerRow;
}): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const completedAt = new Date().toISOString();
  const finalized = await supabase.rpc("finalize_billing_attempt_success", {
    p_order_id: input.order.id,
    p_attempt_number: input.order.attempt_count,
    p_intent_id: input.intent.id,
    p_stripe_reference: stripePaymentIntentReference(input.intent),
    p_completed_at: completedAt,
  });
  if (finalized.error) {
    await recordBillingReconciliationCase({
      billingOrderId: input.order.id,
      stripeObjectId: input.intent.id,
      discrepancyType: "stripe_paid_local_missing",
      evidence: { error: finalized.error.message },
    });
    throw new Error(finalized.error.message);
  }
  if (finalizedExecutionState(finalized.data) !== "succeeded") {
    throw new Error("Stripe success did not finalize the billing order.");
  }
  await notifyAutomaticBillingResult({
    billingOrderId: input.order.id,
    membershipId: input.membership.id,
    homeownerId: input.homeowner.id,
    homeownerFirstName: input.homeowner.first_name,
    scheduledServiceAt: input.order.scheduled_service_at,
    amountCents: input.order.expected_charge_cents,
    outcome: "paid",
    attemptNumber: input.order.attempt_count,
  });
}

async function reconcileFailedPaymentIntent(input: {
  intent: Stripe.PaymentIntent;
  order: WebhookOrderRow;
  membership: WebhookMembershipRow;
  homeowner: WebhookHomeownerRow;
}): Promise<void> {
  const message =
    input.intent.last_payment_error?.message ??
    "Stripe reported that the saved payment method needs customer attention.";
  const code =
    input.intent.last_payment_error?.code ?? input.intent.status;
  const supabase = createServiceRoleSupabaseClient();
  const finalized = await supabase.rpc("finalize_billing_attempt_failure", {
    p_order_id: input.order.id,
    p_attempt_number: input.order.attempt_count,
    p_outcome: "needs_action",
    p_intent_id: input.intent.id,
    p_next_attempt_at: null,
    p_failure_code: code,
    p_failure_message: message,
    p_completed_at: new Date().toISOString(),
  });
  if (finalized.error) throw new Error(finalized.error.message);
  const finalState = finalizedExecutionState(finalized.data);
  // Stripe doesn't guarantee event ordering. A late failure event must not
  // contradict a success already finalized by the executor or another event.
  if (
    finalState === "succeeded" ||
    finalState === "void"
  ) {
    return;
  }
  if (finalState !== "needs_action") {
    throw new Error("Stripe failure did not finalize the billing order.");
  }
  await notifyAutomaticBillingResult({
    billingOrderId: input.order.id,
    membershipId: input.membership.id,
    homeownerId: input.homeowner.id,
    homeownerFirstName: input.homeowner.first_name,
    scheduledServiceAt: input.order.scheduled_service_at,
    amountCents: input.order.expected_charge_cents,
    outcome: "needs_action",
    attemptNumber: input.order.attempt_count,
  });
}

async function claimWebhookEvent(input: {
  event: Stripe.Event;
  rawBody: string;
}): Promise<"claimed" | "duplicate"> {
  const supabase = createServiceRoleSupabaseClient();
  const claim = await supabase.rpc("claim_stripe_event", {
    p_stripe_event_id: input.event.id,
    p_event_type: input.event.type,
    p_api_version: input.event.api_version,
    p_livemode: input.event.livemode,
    p_object_id: eventObjectId(input.event),
    p_payload_hash: createHash("sha256")
      .update(input.rawBody)
      .digest("hex"),
    p_now: new Date().toISOString(),
  });
  if (claim.error) throw new Error(claim.error.message);
  if (claim.data === "duplicate") return "duplicate";
  if (claim.data === "busy") {
    throw new Error("Stripe event reconciliation is already in progress.");
  }
  if (claim.data !== "claimed") {
    throw new Error("Stripe event could not be claimed.");
  }
  return "claimed";
}

async function markWebhookProcessed(event: Stripe.Event): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const verifiedAt = new Date().toISOString();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  // Test-mode deliveries prove only the test endpoint secret. Automatic
  // billing is live-only, so they must never arm the live payment gate.
  if (webhookSecret && event.livemode && isStripeLiveMode()) {
    const verified = await supabase
      .from("billing_automation_settings")
      .update({
        stripe_webhook_verified_at: verifiedAt,
        stripe_webhook_secret_fingerprint: createHash("sha256")
          .update(webhookSecret)
          .digest("hex"),
      })
      .eq("id", "default");
    if (verified.error) throw new Error(verified.error.message);
  }
  // Mark the event terminal only after every required local side effect. If
  // the settings write fails, Stripe's retry can reclaim this event instead
  // of finding an irreversibly processed ledger row.
  const processed = await supabase
    .from("stripe_event_ledger")
    .update({
      processed_at: verifiedAt,
      processing_started_at: null,
      processing_error: null,
    })
    .eq("stripe_event_id", event.id);
  if (processed.error) throw new Error(processed.error.message);
}

export async function processStripeBillingWebhook(input: {
  event: Stripe.Event;
  rawBody: string;
}): Promise<StripeBillingWebhookResult> {
  if ((await claimWebhookEvent(input)) === "duplicate") {
    return { status: "duplicate", billingOrderId: null };
  }

  const supabase = createServiceRoleSupabaseClient();
  const intent = paymentIntentFromEvent(input.event);
  const billingOrderId =
    intent?.metadata.homeatlas_billing_order_id?.trim() || null;
  try {
    if (!intent || !billingOrderId) {
      await markWebhookProcessed(input.event);
      return { status: "ignored", billingOrderId };
    }
    if (
      ![
        "payment_intent.succeeded",
        "payment_intent.payment_failed",
        "payment_intent.requires_action",
      ].includes(input.event.type)
    ) {
      await markWebhookProcessed(input.event);
      return { status: "ignored", billingOrderId };
    }
    const context = await loadWebhookContext(billingOrderId);
    if (!context) {
      throw new Error(
        `Stripe event references missing billing context ${billingOrderId}.`,
      );
    }
    if (
      !(await validateWebhookBinding({
        event: input.event,
        intent,
        ...context,
      }))
    ) {
      await markWebhookProcessed(input.event);
      return { status: "processed", billingOrderId };
    }

    if (input.event.type === "payment_intent.succeeded") {
      await reconcileSucceededPaymentIntent({ intent, ...context });
    } else if (
      input.event.type === "payment_intent.payment_failed" ||
      input.event.type === "payment_intent.requires_action"
    ) {
      await reconcileFailedPaymentIntent({ intent, ...context });
    }
    await markWebhookProcessed(input.event);
    return { status: "processed", billingOrderId };
  } catch (error) {
    await supabase
      .from("stripe_event_ledger")
      .update({
        processing_started_at: null,
        processing_error:
          error instanceof Error ? error.message.slice(0, 500) : "unknown",
      })
      .eq("stripe_event_id", input.event.id);
    throw error;
  }
}
