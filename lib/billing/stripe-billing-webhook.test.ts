import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServiceRoleSupabaseClient: vi.fn(),
  notifyAutomaticBillingResult: vi.fn(),
  recordBillingReconciliationCase: vi.fn(),
  reconcileMemberAddonPaymentIntent: vi.fn(),
}));

vi.mock("@/lib/persistence/supabase/client", () => ({
  createServiceRoleSupabaseClient: mocks.createServiceRoleSupabaseClient,
}));
vi.mock("@/lib/stripe/mode", () => ({ isStripeLiveMode: () => true }));
vi.mock("./automatic-billing-notifications", () => ({
  notifyAutomaticBillingResult: mocks.notifyAutomaticBillingResult,
}));
vi.mock("./reconciliation", () => ({
  recordBillingReconciliationCase: mocks.recordBillingReconciliationCase,
}));
vi.mock("./member-addon-checkout", () => ({
  reconcileMemberAddonPaymentIntent: mocks.reconcileMemberAddonPaymentIntent,
}));

import { processStripeBillingWebhook } from "./stripe-billing-webhook";

const order = {
  id: "11111111-1111-4111-8111-111111111111",
  membership_id: "membership-123",
  property_id: "property-123",
  appointment_id: "appointment-123",
  service_month: "2026-08-01",
  scheduled_service_at: "2026-08-15T17:00:00.000Z",
  expected_charge_cents: 25000,
  execution_state: "processing",
  attempt_count: 1,
  stripe_payment_intent_id: "pi_123",
};

function queryResult(data: unknown) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  return chain;
}

function clientForFinalState(finalState: string) {
  const sideEffectOrder: string[] = [];
  const rpc = vi.fn(async (name: string) => {
    if (name === "claim_stripe_event") {
      return { data: "claimed", error: null };
    }
    if (
      name === "finalize_billing_attempt_success" ||
      name === "finalize_billing_attempt_failure"
    ) {
      return { data: { execution_state: finalState }, error: null };
    }
    throw new Error(`Unexpected RPC ${name}`);
  });
  const from = vi.fn((table: string) => {
    if (table === "billing_orders") return queryResult(order);
    if (table === "memberships") {
      return queryResult({
        id: order.membership_id,
        homeowner_id: "homeowner-123",
        stripe_customer_id: "cus_123",
      });
    }
    if (table === "homeowners") {
      return queryResult({ id: "homeowner-123", first_name: "Avery" });
    }
    if (
      table === "billing_automation_settings" ||
      table === "stripe_event_ledger"
    ) {
      return {
        update: vi.fn(() => ({
          eq: vi.fn(async () => {
            sideEffectOrder.push(
              table === "billing_automation_settings" ? "settings" : "ledger",
            );
            return { error: null };
          }),
        })),
      };
    }
    throw new Error(`Unexpected table ${table}`);
  });
  return { client: { rpc, from }, sideEffectOrder };
}

function paymentIntentEvent(input: {
  type: "payment_intent.succeeded" | "payment_intent.payment_failed";
  status: "succeeded" | "requires_payment_method";
}): Stripe.Event {
  return {
    id: `evt_${input.status}`,
    object: "event",
    api_version: "2026-06-30.basil",
    created: 0,
    data: {
      object: {
        id: "pi_123",
        object: "payment_intent",
        amount: 25000,
        amount_received: input.status === "succeeded" ? 25000 : 0,
        currency: "usd",
        customer: "cus_123",
        latest_charge: input.status === "succeeded" ? "ch_123" : null,
        last_payment_error:
          input.status === "requires_payment_method"
            ? { code: "card_declined", message: "Card declined" }
            : null,
        livemode: true,
        metadata: {
          homeatlas_billing_order_id: order.id,
          membership_id: order.membership_id,
          property_id: order.property_id,
          appointment_id: order.appointment_id,
          service_month: order.service_month,
        },
        status: input.status,
      } as unknown as Stripe.PaymentIntent,
    },
    livemode: true,
    pending_webhooks: 1,
    request: null,
    type: input.type,
  } as Stripe.Event;
}

function setupIntentCreatedEvent(livemode: boolean): Stripe.Event {
  return {
    id: `evt_setup_${livemode ? "live" : "test"}`,
    object: "event",
    api_version: "2026-06-30.basil",
    created: 0,
    data: {
      object: {
        id: "seti_verify",
        object: "setup_intent",
        livemode,
        metadata: { homeatlas_operation: "live_webhook_verification" },
        status: "requires_payment_method",
      } as unknown as Stripe.SetupIntent,
    },
    livemode,
    pending_webhooks: 1,
    request: null,
    type: "setup_intent.created",
  } as Stripe.Event;
}

function memberAddonIntentEvent(): Stripe.Event {
  const event = paymentIntentEvent({
    type: "payment_intent.succeeded",
    status: "succeeded",
  });
  const intent = event.data.object as Stripe.PaymentIntent;
  intent.metadata = {
    homeatlas_operation: "member_addon_checkout",
    homeatlas_addon_id: "addon_123",
    membership_id: "membership-123",
    property_id: "property-123",
  };
  return event;
}

describe("Stripe billing webhook reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    mocks.reconcileMemberAddonPaymentIntent.mockResolvedValue("paid");
  });

  it("verifies the current webhook secret from a signed live no-charge event", async () => {
    const { client, sideEffectOrder } = clientForFinalState("ignored");
    mocks.createServiceRoleSupabaseClient.mockReturnValue(client);

    await expect(
      processStripeBillingWebhook({
        event: setupIntentCreatedEvent(true),
        rawBody: "signed-live-setup-intent",
      }),
    ).resolves.toEqual({ status: "ignored", billingOrderId: null });
    expect(sideEffectOrder).toEqual(["settings", "ledger"]);
  });

  it("does not verify live billing from a signed test-mode event", async () => {
    const { client, sideEffectOrder } = clientForFinalState("ignored");
    mocks.createServiceRoleSupabaseClient.mockReturnValue(client);

    await expect(
      processStripeBillingWebhook({
        event: setupIntentCreatedEvent(false),
        rawBody: "signed-test-setup-intent",
      }),
    ).resolves.toEqual({ status: "ignored", billingOrderId: null });
    expect(sideEffectOrder).toEqual(["ledger"]);
  });

  it("sends the shared paid email when the webhook is the completing path", async () => {
    const { client, sideEffectOrder } = clientForFinalState("succeeded");
    mocks.createServiceRoleSupabaseClient.mockReturnValue(client);

    const result = await processStripeBillingWebhook({
      event: paymentIntentEvent({
        type: "payment_intent.succeeded",
        status: "succeeded",
      }),
      rawBody: "signed-body",
    });

    expect(result).toEqual({ status: "processed", billingOrderId: order.id });
    expect(mocks.notifyAutomaticBillingResult).toHaveBeenCalledWith(
      expect.objectContaining({
        billingOrderId: order.id,
        outcome: "paid",
        attemptNumber: 1,
      }),
    );
    expect(sideEffectOrder).toEqual(["settings", "ledger"]);
  });

  it("reconciles customer-approved add-on payments without treating them as billing orders", async () => {
    const { client } = clientForFinalState("ignored");
    mocks.createServiceRoleSupabaseClient.mockReturnValue(client);

    await expect(
      processStripeBillingWebhook({
        event: memberAddonIntentEvent(),
        rawBody: "signed-addon-body",
      }),
    ).resolves.toEqual({ status: "processed", billingOrderId: null });
    expect(mocks.reconcileMemberAddonPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "payment_intent.succeeded" }),
    );
    expect(mocks.notifyAutomaticBillingResult).not.toHaveBeenCalled();
  });

  it("does not send a false failure notice when success already won the race", async () => {
    const { client } = clientForFinalState("succeeded");
    mocks.createServiceRoleSupabaseClient.mockReturnValue(client);

    await processStripeBillingWebhook({
      event: paymentIntentEvent({
        type: "payment_intent.payment_failed",
        status: "requires_payment_method",
      }),
      rawBody: "signed-body",
    });

    expect(mocks.notifyAutomaticBillingResult).not.toHaveBeenCalled();
  });

  it("quarantines an event whose declared type contradicts its intent status", async () => {
    const { client } = clientForFinalState("reconciliation_required");
    mocks.createServiceRoleSupabaseClient.mockReturnValue(client);

    await processStripeBillingWebhook({
      event: paymentIntentEvent({
        type: "payment_intent.succeeded",
        status: "requires_payment_method",
      }),
      rawBody: "signed-body",
    });

    expect(mocks.recordBillingReconciliationCase).toHaveBeenCalledWith(
      expect.objectContaining({
        billingOrderId: order.id,
        evidence: expect.objectContaining({
          issues: expect.arrayContaining([
            "stripe_succeeded_event_status_mismatch",
          ]),
        }),
      }),
    );
    expect(mocks.notifyAutomaticBillingResult).not.toHaveBeenCalled();
  });
});
