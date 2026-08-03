import "server-only";

import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { isStripeLiveMode } from "@/lib/stripe/mode";
import { automaticBillingServiceMonth } from "./automatic-billing-rules";
import {
  membershipBillingTermsHash,
  MEMBERSHIP_BILLING_AUTHORIZATION_VERSION,
} from "./membership-billing-authorization";
import {
  isCurrentStripeWebhookVerified,
  loadAutomaticBillingSettings,
  nextAutomaticBillingDate,
} from "./automatic-billing-settings";

export interface AutomaticBillingControlView {
  settings: Awaited<ReturnType<typeof loadAutomaticBillingSettings>>;
  nextAutomaticBillingDate: string;
  stripeLive: boolean;
  stripeWebhookConfigured: boolean;
  stripeWebhookVerified: boolean;
  stripeWebhookVerifiedAt: string | null;
  readyOrderCount: number;
  failedOrderCount: number;
  needsActionCount: number;
  reconciliationRequiredCount: number;
  paidOrderCount: number;
}

async function countOrders(input: {
  executionStates?: string[];
  previewStates?: string[];
}): Promise<number> {
  const supabase = createServiceRoleSupabaseClient();
  let query = supabase
    .from("billing_orders")
    .select("id", { count: "exact", head: true });
  if (input.executionStates?.length) {
    query = query.in("execution_state", input.executionStates);
  }
  if (input.previewStates?.length) {
    query = query.in("preview_state", input.previewStates);
  }
  const result = await query;
  if (result.error) throw new Error(result.error.message);
  return result.count ?? 0;
}

export async function loadAutomaticBillingControlView(
  referenceDate = new Date(),
): Promise<AutomaticBillingControlView> {
  const [
    settings,
    readyOrderCount,
    failedOrderCount,
    needsActionCount,
    reconciliationRequiredCount,
    paidOrderCount,
  ] =
    await Promise.all([
      loadAutomaticBillingSettings(),
      countOrders({
        executionStates: ["disabled", "pending"],
        previewStates: ["ready", "locked"],
      }),
      countOrders({ executionStates: ["failed_retryable", "permanently_failed"] }),
      countOrders({ executionStates: ["needs_action"] }),
      countOrders({ executionStates: ["reconciliation_required"] }),
      countOrders({ executionStates: ["succeeded"] }),
    ]);
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
  return {
    settings,
    nextAutomaticBillingDate: nextAutomaticBillingDate(referenceDate),
    stripeLive: isStripeLiveMode(),
    stripeWebhookConfigured: Boolean(webhookSecret),
    stripeWebhookVerified: isCurrentStripeWebhookVerified(settings),
    stripeWebhookVerifiedAt: settings.stripeWebhookVerifiedAt,
    readyOrderCount,
    failedOrderCount,
    needsActionCount,
    reconciliationRequiredCount,
    paidOrderCount,
  };
}

export async function setMembershipAutomaticBilling(input: {
  membershipId: string;
  enabled: boolean;
  actor: string;
  reason?: string;
}): Promise<void> {
  const membershipId = input.membershipId.trim();
  const actor = input.actor.trim();
  if (!membershipId || !actor) throw new Error("Membership and actor are required.");
  const reason = input.reason?.trim() || "Founder changed automatic billing in HQ";
  const supabase = createServiceRoleSupabaseClient();
  if (input.enabled) {
    const membershipResult = await supabase
      .from("memberships")
      .select("id, property_id, agreement_id, visit_price")
      .eq("id", membershipId)
      .maybeSingle();
    if (membershipResult.error) throw new Error(membershipResult.error.message);
    if (!membershipResult.data?.agreement_id) {
      throw new Error("Verify the member's signed billing authorization first.");
    }
    const agreementResult = await supabase
      .from("signed_agreements")
      .select(
        "status, membership_id, property_id, billing_authorization_version, billing_authorized_at, authorized_visit_price_cents, billing_terms_hash",
      )
      .eq("id", membershipResult.data.agreement_id)
      .maybeSingle();
    if (agreementResult.error) throw new Error(agreementResult.error.message);
    const priceCents = Math.round(Number(membershipResult.data.visit_price) * 100);
    const agreement = agreementResult.data;
    if (
      !agreement ||
      agreement.status !== "complete" ||
      agreement.membership_id !== membershipId ||
      agreement.property_id !== membershipResult.data.property_id ||
      agreement.billing_authorization_version !==
        MEMBERSHIP_BILLING_AUTHORIZATION_VERSION ||
      !agreement.billing_authorized_at ||
      agreement.authorized_visit_price_cents !== priceCents ||
      agreement.billing_terms_hash !== membershipBillingTermsHash()
    ) {
      throw new Error("Verify the member's signed billing authorization first.");
    }
  }
  const result = await supabase
    .from("memberships")
    .update({
      automatic_billing_enabled: input.enabled,
      automatic_billing_paused_at: input.enabled ? null : new Date().toISOString(),
      automatic_billing_pause_reason: input.enabled
        ? null
        : `${reason} (${actor})`,
    })
    .eq("id", membershipId)
    .select("id")
    .maybeSingle();
  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("Membership not found.");
  if (!input.enabled) {
    const pausedAt = new Date().toISOString();
    const providerContacted = await supabase
      .from("billing_orders")
      .select("id, attempt_count, stripe_payment_intent_id, execution_state")
      .eq("membership_id", membershipId)
      .in("execution_state", ["processing", "failed_retryable", "pending"])
      .neq("preview_state", "void");
    if (providerContacted.error) {
      throw new Error(providerContacted.error.message);
    }
    for (const order of providerContacted.data ?? []) {
      const processing =
        order.execution_state === "processing" ||
        (order.execution_state === "pending" &&
          Boolean(order.stripe_payment_intent_id));
      if (order.execution_state === "pending" && !processing) continue;
      const finalized = await supabase.rpc(
        "finalize_billing_attempt_failure",
        {
          p_order_id: order.id,
          p_attempt_number: order.attempt_count,
          p_outcome: processing
            ? "reconciliation_required"
            : "permanently_failed",
          p_intent_id: order.stripe_payment_intent_id,
          p_next_attempt_at: null,
          p_failure_code: processing
            ? "membership_paused_during_processing"
            : "membership_automatic_billing_paused",
          p_failure_message: processing
            ? "The member was paused while this Stripe attempt was in flight."
            : reason,
          p_completed_at: pausedAt,
        },
      );
      if (finalized.error) throw new Error(finalized.error.message);
    }
    const orders = await supabase
      .from("billing_orders")
      .select("id")
      .eq("membership_id", membershipId)
      .in("execution_state", ["disabled", "pending"])
      .is("stripe_payment_intent_id", null)
      .neq("preview_state", "void");
    if (orders.error) throw new Error(orders.error.message);
    for (const order of orders.data ?? []) {
      const voided = await supabase
        .from("billing_orders")
        .update({
          preview_state: "void",
          execution_state: "void",
          locked_at: null,
          lease_owner: null,
          lease_expires_at: null,
          blocking_reasons: ["membership_automatic_billing_paused"],
          failure_code: "membership_automatic_billing_paused",
          failure_message: reason,
        })
        .eq("id", order.id)
        .in("execution_state", ["disabled", "pending"])
        .is("stripe_payment_intent_id", null)
        .select("id")
        .maybeSingle();
      if (voided.error) throw new Error(voided.error.message);
      if (!voided.data) continue;
      const event = await supabase.from("billing_order_events").insert({
        billing_order_id: order.id,
        event_type: "voided",
        actor,
        reason,
        event_data: { membership_id: membershipId },
      });
      if (event.error) throw new Error(event.error.message);
    }
  }
}

export async function attestMembershipBillingAuthorization(input: {
  membershipId: string;
  actor: string;
}): Promise<void> {
  if (!input.membershipId.trim() || !input.actor.trim()) {
    throw new Error("Membership and actor are required.");
  }
  const supabase = createServiceRoleSupabaseClient();
  const result = await supabase.rpc("attest_membership_billing_authorization", {
    p_membership_id: input.membershipId.trim(),
    p_actor: input.actor.trim(),
    p_authorization_version: MEMBERSHIP_BILLING_AUTHORIZATION_VERSION,
    p_billing_terms_hash: membershipBillingTermsHash(),
    p_now: new Date().toISOString(),
  });
  if (result.error) throw new Error(result.error.message);
}

export async function prepareFounderRetry(input: {
  billingOrderId: string;
  actor: string;
}): Promise<void> {
  const billingOrderId = input.billingOrderId.trim();
  if (!billingOrderId || !input.actor.trim()) {
    throw new Error("Billing order and actor are required.");
  }
  const settings = await loadAutomaticBillingSettings();
  if (!settings.enabled || settings.executionMode !== "automatic") {
    throw new Error(
      "Arm automatic billing before retrying an exact failed charge.",
    );
  }
  const now = new Date().toISOString();
  const serviceMonth = automaticBillingServiceMonth(new Date());
  if (!serviceMonth) throw new Error("Current service month is unavailable.");
  const supabase = createServiceRoleSupabaseClient();
  const result = await supabase.rpc("prepare_founder_billing_retry", {
    p_order_id: billingOrderId,
    p_actor: input.actor.trim(),
    p_service_month: serviceMonth,
    p_now: now,
  });
  if (result.error) throw new Error(result.error.message);
}
