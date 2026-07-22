import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { PaymentSetupContext } from "./payment-setup-authorization";

const mocks = vi.hoisted(() => ({
  stripeEnabled: true,
  supabaseConfigured: true,
  serviceRoleConfigured: true,
  loadContext: vi.fn(),
  rpc: vi.fn(),
  customersCreate: vi.fn(),
  customersRetrieve: vi.fn(),
  customersUpdate: vi.fn(),
  setupIntentsCreate: vi.fn(),
  setupIntentsRetrieve: vi.fn(),
  paymentMethodsRetrieve: vi.fn(),
  portalUrl: vi.fn(),
  welcome: vi.fn(),
}));

vi.mock("@/lib/persistence/supabase/client", () => ({
  isSupabaseConfigured: () => mocks.supabaseConfigured,
  isServiceRoleConfigured: () => mocks.serviceRoleConfigured,
  createServiceRoleSupabaseClient: () => ({ rpc: mocks.rpc }),
}));
vi.mock("@/lib/membership/payment-setup-authorization", async (original) => ({
  ...(await original<
    typeof import("@/lib/membership/payment-setup-authorization")
  >()),
  loadPaymentSetupContext: mocks.loadContext,
}));
vi.mock("@/lib/stripe/config", () => ({
  isStripeServerEnabled: () => mocks.stripeEnabled,
}));
vi.mock("@/lib/stripe/mode", () => ({
  resolveStripeKeyMode: () => "test",
}));
vi.mock("@/lib/stripe/server", () => ({
  getStripe: () => ({
    customers: {
      create: mocks.customersCreate,
      retrieve: mocks.customersRetrieve,
      update: mocks.customersUpdate,
    },
    setupIntents: {
      create: mocks.setupIntentsCreate,
      retrieve: mocks.setupIntentsRetrieve,
    },
    paymentMethods: { retrieve: mocks.paymentMethodsRetrieve },
  }),
}));
vi.mock("@/lib/persistence/queries/portal-access", () => ({
  getPortalAccessUrlForMembership: mocks.portalUrl,
}));
vi.mock("@/lib/agreement/send-welcome-email", () => ({
  sendWelcomeEmail: mocks.welcome,
}));

import { POST as createSetupIntent } from "../../app/api/stripe/setup-intent/route";
import { POST as activatePaymentSetup } from "../../app/api/membership/setup-payment/route";

const IDS = {
  membership: "11111111-1111-4111-8111-111111111111",
  presentation: "22222222-2222-4222-8222-222222222222",
  agreement: "33333333-3333-4333-8333-333333333333",
  homeowner: "44444444-4444-4444-8444-444444444444",
  property: "55555555-5555-4555-8555-555555555555",
  sale: "88888888-8888-4888-8888-888888888888",
};
const CUSTOMER_ID = "cus_expected123";
const SETUP_INTENT_ID = "seti_expected123";
const PAYMENT_METHOD_ID = "pm_expected123";
const RECONCILIATION_ATTEMPT_ID = "77777777-7777-4777-8777-777777777777";
const AUTHORITY_SHA256 = "a".repeat(64);

function reconciliationAttempt() {
  return {
    id: RECONCILIATION_ATTEMPT_ID,
    membership_id: IDS.membership,
    presentation_id: IDS.presentation,
    agreement_id: IDS.agreement,
    homeowner_id: IDS.homeowner,
    property_id: IDS.property,
    capability_kind: "presentation" as const,
    sales_tier: "quarterly" as const,
    visit_price: 225,
    visits_per_year: 4,
    enrollment_savings: 25,
    presentation_authority_sha256: AUTHORITY_SHA256,
    customer_idempotency_key: `homeatlas:membership-customer:v1:${IDS.membership}`,
    setup_intent_idempotency_key: `homeatlas:membership-setup:v2:${IDS.membership}`,
    operation_phase: "before_provider" as const,
    operation_status: "reserved" as const,
    created_at: "2026-07-14T12:00:00.000Z",
  };
}

function context(
  overrides: {
    status?: string;
    onboardingStatus?: string;
    customerId?: string | null;
    setupIntentId?: string | null;
    paymentMethodId?: string | null;
    paymentCompletedAt?: string | null;
    presentationMembershipId?: string;
  } = {},
): PaymentSetupContext {
  return {
    membership: {
      id: IDS.membership,
      homeowner_id: IDS.homeowner,
      property_id: IDS.property,
      presentation_id: IDS.presentation,
      agreement_id: IDS.agreement,
      portal_access_token: "a".repeat(43),
      status: overrides.status ?? "pending_payment",
      sales_tier: "quarterly",
      visit_price: 225,
      visits_per_year: 4,
      stripe_customer_id: overrides.customerId ?? null,
      stripe_payment_method_id: overrides.paymentMethodId ?? null,
      stripe_setup_intent_id: overrides.setupIntentId ?? null,
      payment_setup_completed_at: overrides.paymentCompletedAt ?? null,
      started_at: "2026-07-14T12:00:00.000Z",
    },
    presentation: {
      id: IDS.presentation,
      status: "signed",
      signed_at: "2026-07-14T12:00:00.000Z",
      agreement_id: IDS.agreement,
      membership_id:
        overrides.presentationMembershipId ?? IDS.membership,
      homeowner_id: IDS.homeowner,
      property_id: IDS.property,
      onboarding_status: overrides.onboardingStatus ?? "pending_payment",
      tier: "quarterly",
      enrollment_savings: 25,
      authority_sha256: AUTHORITY_SHA256,
      quote_snapshot: {
        sqft: 2500,
        frequency: "quarterly",
        includeInterior: false,
        twoStory: false,
        includeScreens: false,
        windowCareVisitPrice: 225,
        frequencyLabel: "Quarterly",
        exteriorAddOnQuote: {
          lineItems: [],
          subtotal: 0,
          listSubtotal: 0,
          memberDiscountPercent: null,
          memberSavings: 0,
        },
        totalEstimate: 225,
        authority: "atlas_pricing_engine_v1",
        pricingSettingsUpdatedAt: "2026-07-14T10:00:00.000Z",
        tierVisitPrices: { biannual: 320, quarterly: 225 },
        tierEnrollmentSavings: { biannual: 15, quarterly: 25 },
        exteriorAddOnSelections: [],
      },
    },
    agreement: {
      id: IDS.agreement,
      status: "complete",
      membership_id: IDS.membership,
      presentation_id: IDS.presentation,
      homeowner_id: IDS.homeowner,
      property_id: IDS.property,
      signing_attempt_id: "66666666-6666-4666-8666-666666666666",
      agreement_tier: "quarterly",
    },
    homeowner: {
      id: IDS.homeowner,
      full_name: "Authoritative Homeowner",
      email: "owner@example.com",
    },
    property: { id: IDS.property, homeowner_id: IDS.homeowner },
    reconciliationAttempt: reconciliationAttempt(),
  };
}

function metadata() {
  return {
    homeatlas_flow: "membership_setup_v1",
    membership_id: IDS.membership,
    presentation_id: IDS.presentation,
    agreement_id: IDS.agreement,
    homeowner_id: IDS.homeowner,
    property_id: IDS.property,
    presentation_authority_sha256: AUTHORITY_SHA256,
    reconciliation_attempt_id: RECONCILIATION_ATTEMPT_ID,
  };
}

function defaultRpc(name: string) {
  if (name === "reserve_membership_stripe_setup_reconciliation") {
    return {
      data: { outcome: "replay", attempt: reconciliationAttempt() },
      error: null,
    };
  }
  if (name === "append_membership_stripe_setup_reconciliation_event") {
    return { data: { outcome: "appended", event_id: IDS.property }, error: null };
  }
  if (name === "activate_membership_after_stripe_setup") {
    return { data: lockedActivation(), error: null };
  }
  return { data: { outcome: "claimed" }, error: null };
}

function lockedActivation(
  overrides: Partial<Record<string, unknown>> = {},
) {
  return {
    outcome: "activated",
    membership_id: IDS.membership,
    presentation_id: IDS.presentation,
    agreement_id: IDS.agreement,
    homeowner_id: IDS.homeowner,
    property_id: IDS.property,
    sales_tier: "quarterly",
    visit_price: 225,
    visits_per_year: 4,
    presentation_authority_sha256: AUTHORITY_SHA256,
    enrollment_savings: 25,
    payment_setup_completed_at: "2026-07-14T12:05:00.000Z",
    started_at: "2026-07-14T12:05:00.000Z",
    sale_id: IDS.sale,
    obligation_count: 4,
    ...overrides,
  };
}

function request(path: string, body: unknown) {
  return new NextRequest(`https://homeatlas.example${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function succeededIntent(overrides: Record<string, unknown> = {}) {
  return {
    id: SETUP_INTENT_ID,
    status: "succeeded",
    livemode: false,
    customer: CUSTOMER_ID,
    payment_method: PAYMENT_METHOD_ID,
    metadata: metadata(),
    ...overrides,
  };
}

describe("PR1c Stripe setup authorization routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.stripeEnabled = true;
    mocks.supabaseConfigured = true;
    mocks.serviceRoleConfigured = true;
    mocks.loadContext.mockResolvedValue(context());
    mocks.rpc.mockImplementation(async (name: string) => defaultRpc(name));
    mocks.customersCreate.mockResolvedValue({
      id: CUSTOMER_ID,
      livemode: false,
      metadata: metadata(),
    });
    mocks.customersRetrieve.mockResolvedValue({
      id: CUSTOMER_ID,
      livemode: false,
      metadata: metadata(),
    });
    mocks.customersUpdate.mockResolvedValue({ id: CUSTOMER_ID });
    mocks.setupIntentsCreate.mockResolvedValue({
      ...succeededIntent({ status: "requires_payment_method" }),
      client_secret: "seti_expected123_secret_test",
    });
    mocks.setupIntentsRetrieve.mockResolvedValue(succeededIntent());
    mocks.paymentMethodsRetrieve.mockResolvedValue({
      id: PAYMENT_METHOD_ID,
      livemode: false,
      customer: CUSTOMER_ID,
    });
    mocks.portalUrl.mockResolvedValue("https://homeatlas.example/portal/token");
    mocks.welcome.mockResolvedValue({ status: "sent" });
  });

  it("rejects missing capability and bare browser membership authority", async () => {
    expect(
      (await createSetupIntent(request("/api/stripe/setup-intent", {}))).status,
    ).toBe(400);
    expect(
      (
        await createSetupIntent(
          request("/api/stripe/setup-intent", { membershipId: IDS.membership }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await createSetupIntent(
          request("/api/stripe/setup-intent", {
            presentationId: IDS.presentation,
            memberName: "Browser Authored",
            memberEmail: "attacker@example.com",
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await activatePaymentSetup(
          request("/api/membership/setup-payment", {
            presentationId: IDS.presentation,
            setupIntentId: SETUP_INTENT_ID,
            paymentMethodId: PAYMENT_METHOD_ID,
          }),
        )
      ).status,
    ).toBe(400);
    expect(mocks.loadContext).not.toHaveBeenCalled();
  });

  it("fails closed when Stripe is disabled", async () => {
    mocks.stripeEnabled = false;
    const response = await activatePaymentSetup(
      request("/api/membership/setup-payment", {
        presentationId: IDS.presentation,
        setupIntentId: SETUP_INTENT_ID,
      }),
    );
    expect(response.status).toBe(503);
    expect(mocks.loadContext).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects an unknown or stale capability", async () => {
    mocks.loadContext.mockResolvedValue(null);
    const response = await createSetupIntent(
      request("/api/stripe/setup-intent", {
        presentationId: IDS.presentation,
      }),
    );
    expect(response.status).toBe(404);
    expect(mocks.customersCreate).not.toHaveBeenCalled();
  });

  it("holds authoritative identity or linkage mismatch before Stripe", async () => {
    mocks.loadContext.mockResolvedValue(
      context({ presentationMembershipId: IDS.property }),
    );
    const response = await createSetupIntent(
      request("/api/stripe/setup-intent", {
        presentationId: IDS.presentation,
      }),
    );
    expect(response.status).toBe(409);
    expect(mocks.customersCreate).not.toHaveBeenCalled();
    expect(mocks.setupIntentsCreate).not.toHaveBeenCalled();
  });

  it("creates and claims Stripe identity only from server-owned records", async () => {
    const response = await createSetupIntent(
      request("/api/stripe/setup-intent", {
        presentationId: IDS.presentation,
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.customersCreate).toHaveBeenCalledWith(
      {
        name: "Authoritative Homeowner",
        email: "owner@example.com",
        metadata: metadata(),
      },
      { idempotencyKey: `homeatlas:membership-customer:v1:${IDS.membership}` },
    );
    expect(mocks.setupIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: CUSTOMER_ID, metadata: metadata() }),
      {
        idempotencyKey: `homeatlas:membership-setup:v2:${IDS.membership}`,
      },
    );
    expect(mocks.rpc).toHaveBeenCalledTimes(8);
    const reservationCall = mocks.rpc.mock.invocationCallOrder[0];
    const customerCreationCall = mocks.customersCreate.mock.invocationCallOrder[0];
    expect(reservationCall).toBeLessThan(customerCreationCall);
    expect(mocks.rpc).toHaveBeenNthCalledWith(
      1,
      "reserve_membership_stripe_setup_reconciliation",
      expect.objectContaining({
        p_membership_id: IDS.membership,
        p_expected_authority_sha256: AUTHORITY_SHA256,
      }),
    );
    await expect(response.json()).resolves.toEqual({
      clientSecret: "seti_expected123_secret_test",
    });
  });

  it("reuses the membership-bound SetupIntent", async () => {
    mocks.loadContext.mockResolvedValue(
      context({ customerId: CUSTOMER_ID, setupIntentId: SETUP_INTENT_ID }),
    );
    mocks.setupIntentsRetrieve.mockResolvedValue({
      ...succeededIntent({ status: "requires_payment_method" }),
      client_secret: "seti_expected123_secret_test",
    });
    const response = await createSetupIntent(
      request("/api/stripe/setup-intent", {
        portalToken: "a".repeat(43),
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.setupIntentsRetrieve).toHaveBeenCalledWith(SETUP_INTENT_ID);
    expect(mocks.setupIntentsCreate).not.toHaveBeenCalled();
  });

  it("records immutable created and observed facts across an exact setup retry", async () => {
    mocks.loadContext
      .mockResolvedValueOnce(context())
      .mockResolvedValueOnce(
        context({ customerId: CUSTOMER_ID, setupIntentId: SETUP_INTENT_ID }),
      );
    mocks.setupIntentsRetrieve.mockResolvedValue({
      ...succeededIntent({ status: "requires_payment_method" }),
      client_secret: "seti_expected123_secret_test",
    });

    const first = await createSetupIntent(
      request("/api/stripe/setup-intent", {
        presentationId: IDS.presentation,
      }),
    );
    const retry = await createSetupIntent(
      request("/api/stripe/setup-intent", {
        presentationId: IDS.presentation,
      }),
    );

    expect(first.status).toBe(200);
    expect(retry.status).toBe(200);
    expect(mocks.customersCreate).toHaveBeenCalledTimes(1);
    expect(mocks.customersRetrieve).toHaveBeenCalledTimes(1);
    expect(mocks.setupIntentsCreate).toHaveBeenCalledTimes(1);
    expect(mocks.setupIntentsRetrieve).toHaveBeenCalledTimes(1);
    const eventCalls = mocks.rpc.mock.calls
      .filter(([name]) =>
        name === "append_membership_stripe_setup_reconciliation_event"
      )
      .map(([, args]) => args as Record<string, unknown>);
    expect(eventCalls.map((args) => args.p_event_key)).toEqual(
      expect.arrayContaining([
        "customer_created",
        "customer_observed",
        "setup_intent_created",
        "setup_intent_observed",
      ]),
    );
    for (const eventKey of new Set(eventCalls.map((args) => args.p_event_key))) {
      const sameKey = eventCalls.filter((args) => args.p_event_key === eventKey);
      expect(new Set(sameKey.map((args) => JSON.stringify(args))).size).toBe(1);
    }
  });

  it("holds an existing Stripe customer with incomplete binding metadata", async () => {
    mocks.loadContext.mockResolvedValue(
      context({ customerId: CUSTOMER_ID }),
    );
    mocks.customersRetrieve.mockResolvedValue({
      id: CUSTOMER_ID,
      livemode: false,
      metadata: { membership_id: IDS.membership },
    });
    const response = await createSetupIntent(
      request("/api/stripe/setup-intent", {
        presentationId: IDS.presentation,
      }),
    );
    expect(response.status).toBe(409);
    expect(mocks.customersUpdate).not.toHaveBeenCalled();
    expect(mocks.setupIntentsCreate).not.toHaveBeenCalled();
  });

  it("holds a transactional customer claim conflict before creating an intent", async () => {
    mocks.rpc.mockImplementation(async (name: string) =>
      name === "claim_membership_stripe_setup"
        ? {
            data: { outcome: "held", reason: "stripe_customer_already_bound" },
            error: null,
          }
        : defaultRpc(name),
    );
    const response = await createSetupIntent(
      request("/api/stripe/setup-intent", {
        presentationId: IDS.presentation,
      }),
    );
    expect(response.status).toBe(409);
    expect(mocks.setupIntentsCreate).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith(
      "append_membership_stripe_setup_reconciliation_event",
      expect.objectContaining({
        p_attempt_id: RECONCILIATION_ATTEMPT_ID,
        p_stripe_customer_id: CUSTOMER_ID,
      }),
    );
  });

  it("replays repeated setup failures without conflicting or losing evidence", async () => {
    mocks.rpc.mockImplementation(async (name: string) =>
      name === "claim_membership_stripe_setup"
        ? {
            data: { outcome: "held", reason: "stripe_customer_already_bound" },
            error: null,
          }
        : defaultRpc(name),
    );

    const first = await createSetupIntent(
      request("/api/stripe/setup-intent", {
        presentationId: IDS.presentation,
      }),
    );
    const retry = await createSetupIntent(
      request("/api/stripe/setup-intent", {
        presentationId: IDS.presentation,
      }),
    );

    expect(first.status).toBe(409);
    expect(retry.status).toBe(409);
    const eventCalls = mocks.rpc.mock.calls
      .filter(([name]) =>
        name === "append_membership_stripe_setup_reconciliation_event"
      )
      .map(([, args]) => args as Record<string, unknown>);
    expect(eventCalls.filter((args) => args.p_event_key === "customer_created"))
      .toHaveLength(2);
    const heldCalls = eventCalls.filter((args) =>
      String(args.p_event_key).startsWith("customer_claim_held:"),
    );
    expect(heldCalls).toHaveLength(2);
    expect(heldCalls[0]).toEqual(heldCalls[1]);
    for (const eventKey of new Set(eventCalls.map((args) => args.p_event_key))) {
      const sameKey = eventCalls.filter((args) => args.p_event_key === eventKey);
      expect(new Set(sameKey.map((args) => JSON.stringify(args))).size).toBe(1);
    }
  });

  it("fails before Stripe when durable reconciliation reservation is held", async () => {
    mocks.rpc.mockImplementation(async (name: string) =>
      name === "reserve_membership_stripe_setup_reconciliation"
        ? {
            data: { outcome: "held", reason: "authoritative_reconciliation_state_changed" },
            error: null,
          }
        : defaultRpc(name),
    );

    const response = await createSetupIntent(
      request("/api/stripe/setup-intent", {
        presentationId: IDS.presentation,
      }),
    );

    expect(response.status).toBe(409);
    expect(mocks.customersCreate).not.toHaveBeenCalled();
    expect(mocks.customersRetrieve).not.toHaveBeenCalled();
    expect(mocks.setupIntentsCreate).not.toHaveBeenCalled();
    expect(mocks.setupIntentsRetrieve).not.toHaveBeenCalled();
  });

  it("rejects an unsuccessful SetupIntent", async () => {
    mocks.loadContext.mockResolvedValue(
      context({ customerId: CUSTOMER_ID, setupIntentId: SETUP_INTENT_ID }),
    );
    mocks.setupIntentsRetrieve.mockResolvedValue(
      succeededIntent({ status: "processing" }),
    );
    const response = await activatePaymentSetup(
      request("/api/membership/setup-payment", {
        presentationId: IDS.presentation,
        setupIntentId: SETUP_INTENT_ID,
      }),
    );
    expect(response.status).toBe(409);
    expect(mocks.paymentMethodsRetrieve).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects wrong customer and wrong membership metadata", async () => {
    mocks.loadContext.mockResolvedValue(
      context({ customerId: CUSTOMER_ID, setupIntentId: SETUP_INTENT_ID }),
    );
    mocks.setupIntentsRetrieve.mockResolvedValueOnce(
      succeededIntent({ customer: "cus_other123" }),
    );
    const wrongCustomer = await activatePaymentSetup(
      request("/api/membership/setup-payment", {
        presentationId: IDS.presentation,
        setupIntentId: SETUP_INTENT_ID,
      }),
    );
    expect(wrongCustomer.status).toBe(409);

    mocks.setupIntentsRetrieve.mockResolvedValueOnce(
      succeededIntent({
        metadata: { ...metadata(), membership_id: IDS.property },
      }),
    );
    const wrongMembership = await activatePaymentSetup(
      request("/api/membership/setup-payment", {
        presentationId: IDS.presentation,
        setupIntentId: SETUP_INTENT_ID,
      }),
    );
    expect(wrongMembership.status).toBe(409);
    expect(mocks.paymentMethodsRetrieve).not.toHaveBeenCalled();
  });

  it("rejects a stale signed pricing authority before Stripe", async () => {
    const stale = context();
    stale.presentation.authority_sha256 = "b".repeat(64);
    stale.presentation.quote_snapshot!.tierVisitPrices!.quarterly = 224;
    mocks.loadContext.mockResolvedValue(stale);
    const response = await createSetupIntent(
      request("/api/stripe/setup-intent", {
        presentationId: IDS.presentation,
      }),
    );
    expect(response.status).toBe(409);
    expect(mocks.customersCreate).not.toHaveBeenCalled();
    expect(mocks.customersUpdate).not.toHaveBeenCalled();
    expect(mocks.setupIntentsCreate).not.toHaveBeenCalled();
  });

  it("rejects changed Stripe customer binding metadata at activation", async () => {
    mocks.loadContext.mockResolvedValue(
      context({ customerId: CUSTOMER_ID, setupIntentId: SETUP_INTENT_ID }),
    );
    mocks.customersRetrieve.mockResolvedValue({
      id: CUSTOMER_ID,
      livemode: false,
      metadata: { ...metadata(), property_id: IDS.homeowner },
    });
    const response = await activatePaymentSetup(
      request("/api/membership/setup-payment", {
        presentationId: IDS.presentation,
        setupIntentId: SETUP_INTENT_ID,
      }),
    );
    expect(response.status).toBe(409);
    expect(mocks.paymentMethodsRetrieve).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects a payment method owned by another customer", async () => {
    mocks.loadContext.mockResolvedValue(
      context({ customerId: CUSTOMER_ID, setupIntentId: SETUP_INTENT_ID }),
    );
    mocks.paymentMethodsRetrieve.mockResolvedValue({
      id: PAYMENT_METHOD_ID,
      livemode: false,
      customer: "cus_other123",
    });
    const response = await activatePaymentSetup(
      request("/api/membership/setup-payment", {
        portalToken: "a".repeat(43),
        setupIntentId: SETUP_INTENT_ID,
      }),
    );
    expect(response.status).toBe(409);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("holds active replay conflicts and paused or cancelled memberships", async () => {
    mocks.loadContext.mockResolvedValue(
      context({
        status: "active",
        onboardingStatus: "complete",
        customerId: CUSTOMER_ID,
        setupIntentId: SETUP_INTENT_ID,
        paymentMethodId: PAYMENT_METHOD_ID,
        paymentCompletedAt: "2026-07-14T12:05:00.000Z",
      }),
    );
    const conflict = await activatePaymentSetup(
      request("/api/membership/setup-payment", {
        presentationId: IDS.presentation,
        setupIntentId: "seti_different123",
      }),
    );
    expect(conflict.status).toBe(409);
    expect(mocks.setupIntentsRetrieve).not.toHaveBeenCalled();

    for (const status of ["paused", "cancelled"]) {
      mocks.loadContext.mockResolvedValue(context({ status }));
      const held = await activatePaymentSetup(
        request("/api/membership/setup-payment", {
          presentationId: IDS.presentation,
          setupIntentId: SETUP_INTENT_ID,
        }),
      );
      expect(held.status).toBe(409);
    }
    expect(mocks.customersUpdate).not.toHaveBeenCalled();
    expect(mocks.setupIntentsRetrieve).not.toHaveBeenCalled();
  });

  it("holds an active replay when Stripe metadata is no longer exact", async () => {
    mocks.loadContext.mockResolvedValue(
      context({
        status: "active",
        onboardingStatus: "complete",
        customerId: CUSTOMER_ID,
        setupIntentId: SETUP_INTENT_ID,
        paymentMethodId: PAYMENT_METHOD_ID,
        paymentCompletedAt: "2026-07-14T12:05:00.000Z",
      }),
    );
    mocks.setupIntentsRetrieve.mockResolvedValue(
      succeededIntent({
        metadata: { ...metadata(), presentation_id: IDS.property },
      }),
    );
    const response = await activatePaymentSetup(
      request("/api/membership/setup-payment", {
        presentationId: IDS.presentation,
        setupIntentId: SETUP_INTENT_ID,
      }),
    );
    expect(response.status).toBe(409);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["missing sale ID", { sale_id: undefined }],
    ["malformed sale ID", { sale_id: "sale-1" }],
    ["missing obligation count", { obligation_count: undefined }],
    ["mismatched obligation count", { obligation_count: 2 }],
  ])(
    "fails closed on %s before portal lookup or welcome email",
    async (_label, resultOverrides) => {
      mocks.loadContext.mockResolvedValue(
        context({ customerId: CUSTOMER_ID, setupIntentId: SETUP_INTENT_ID }),
      );
      mocks.rpc.mockResolvedValueOnce({
        data: lockedActivation(resultOverrides),
        error: null,
      });

      const response = await activatePaymentSetup(
        request("/api/membership/setup-payment", {
          presentationId: IDS.presentation,
          setupIntentId: SETUP_INTENT_ID,
        }),
      );

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({
        error: "Unable to verify and activate card setup",
        recovery:
          "Retry with the same onboarding capability and confirmed SetupIntent.",
      });
      expect(mocks.portalUrl).not.toHaveBeenCalled();
      expect(mocks.welcome).not.toHaveBeenCalled();
      expect(mocks.rpc).not.toHaveBeenCalledWith(
        "append_membership_stripe_setup_reconciliation_event",
        expect.anything(),
      );
    },
  );

  it("accepts complete activated and replay RPC results and emails only after activation", async () => {
    mocks.loadContext.mockResolvedValue(
      context({ customerId: CUSTOMER_ID, setupIntentId: SETUP_INTENT_ID }),
    );
    mocks.rpc.mockResolvedValueOnce({
      data: lockedActivation({
        visit_price: 230,
        visits_per_year: 2,
        sales_tier: "biannual",
        started_at: "2026-07-14T12:04:00.000Z",
        obligation_count: 2,
      }),
      error: null,
    });
    const first = await activatePaymentSetup(
      request("/api/membership/setup-payment", {
        presentationId: IDS.presentation,
        setupIntentId: SETUP_INTENT_ID,
      }),
    );
    expect(first.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "activate_membership_after_stripe_setup",
      expect.objectContaining({
        p_membership_id: IDS.membership,
        p_expected_authority_sha256: AUTHORITY_SHA256,
        p_reconciliation_attempt_id: RECONCILIATION_ATTEMPT_ID,
        p_stripe_customer_id: CUSTOMER_ID,
        p_stripe_setup_intent_id: SETUP_INTENT_ID,
        p_stripe_payment_method_id: PAYMENT_METHOD_ID,
        p_stripe_livemode: false,
      }),
    );
    expect(mocks.customersUpdate).not.toHaveBeenCalled();
    expect((await first.json()).alreadyActive).toBe(false);
    expect(mocks.portalUrl).toHaveBeenCalledTimes(1);
    expect(mocks.welcome).toHaveBeenCalledTimes(1);

    mocks.loadContext.mockResolvedValue(
      context({
        status: "active",
        onboardingStatus: "complete",
        customerId: CUSTOMER_ID,
        setupIntentId: SETUP_INTENT_ID,
        paymentMethodId: PAYMENT_METHOD_ID,
        paymentCompletedAt: "2026-07-14T12:05:00.000Z",
      }),
    );
    mocks.rpc.mockResolvedValueOnce({
      data: lockedActivation({
        outcome: "replay",
        visit_price: 230,
        visits_per_year: 2,
        sales_tier: "biannual",
        started_at: "2026-07-14T12:04:00.000Z",
        obligation_count: 2,
      }),
      error: null,
    });
    const replay = await activatePaymentSetup(
      request("/api/membership/setup-payment", {
        presentationId: IDS.presentation,
        setupIntentId: SETUP_INTENT_ID,
      }),
    );
    expect(replay.status).toBe(200);
    expect((await replay.json()).alreadyActive).toBe(true);
    expect(mocks.portalUrl).toHaveBeenCalledTimes(2);
    expect(mocks.welcome).toHaveBeenCalledTimes(1);
    const activationEventKeys = mocks.rpc.mock.calls
      .filter(([name]) =>
        name === "append_membership_stripe_setup_reconciliation_event"
      )
      .map(([, args]) => (args as Record<string, unknown>).p_event_key);
    expect(activationEventKeys).toEqual([
      "activation_completed",
      "activation_replay_observed",
    ]);
  });

  it("holds an activation linkage race without mutating Stripe or follow-up state", async () => {
    mocks.loadContext.mockResolvedValue(
      context({ customerId: CUSTOMER_ID, setupIntentId: SETUP_INTENT_ID }),
    );
    mocks.rpc.mockResolvedValueOnce({
      data: { outcome: "held", reason: "authoritative_linkage_changed" },
      error: null,
    });

    const response = await activatePaymentSetup(
      request("/api/membership/setup-payment", {
        presentationId: IDS.presentation,
        setupIntentId: SETUP_INTENT_ID,
      }),
    );

    expect(response.status).toBe(409);
    expect(mocks.setupIntentsRetrieve).toHaveBeenCalledTimes(1);
    expect(mocks.customersRetrieve).toHaveBeenCalledTimes(1);
    expect(mocks.paymentMethodsRetrieve).toHaveBeenCalledTimes(1);
    expect(mocks.customersUpdate).not.toHaveBeenCalled();
    expect(mocks.portalUrl).not.toHaveBeenCalled();
    expect(mocks.welcome).not.toHaveBeenCalled();
  });
});
