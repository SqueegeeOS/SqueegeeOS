import { describe, expect, it } from "vitest";
import {
  buildSalesProductionHandoffSnapshot,
  deriveSalesProductionHandoff,
  type SalesProductionHandoffInput,
} from "./production-handoff";

function source(
  overrides: Partial<SalesProductionHandoffInput> = {},
): SalesProductionHandoffInput {
  return {
    attributionId: "attribution-1",
    membershipId: "membership-1",
    homeownerName: "Mandi Rivera",
    propertyAddress: "88 Oak Way",
    attributedArrCents: 120_000,
    attributedAt: "2026-08-14T18:00:00.000Z",
    membership: {
      id: "membership-1",
      homeowner_id: "homeowner-1",
      property_id: "property-1",
      status: "active",
      payment_setup_completed_at: "2026-08-14T17:00:00.000Z",
      stripe_payment_method_id: "payment-method-present",
      stripe_customer_id: "customer-present",
      agreement_id: "agreement-1",
      presentation_id: "presentation-1",
      sales_tier: "quarterly",
      visit_price: 300,
      visits_per_year: 4,
    },
    paymentSetupEmailState: "card_on_file",
    paymentHandoffProgress: {
      state: "completed",
      canSend: false,
      emailSentAt: "2026-08-14T17:00:00.000Z",
      expiresAt: "2026-08-15T17:00:00.000Z",
    },
    propertyLinked: true,
    recurringJobCount: 1,
    scheduleSourceState: "fresh",
    scheduleObservedAt: "2026-08-14T17:30:00.000Z",
    nextScheduledAt: "2026-09-01T16:00:00.000Z",
    ...overrides,
  };
}

describe("sales-to-production handoff", () => {
  it("requires a durable membership before any downstream handoff claim", () => {
    const result = deriveSalesProductionHandoff(
      source({ membership: null }),
    );

    expect(result).toMatchObject({
      stage: "membership_attention",
      completedSteps: 1,
      actionHref: "/hq/memberships",
    });
  });

  it("prioritizes payment readiness and safe activation before Jobber work", () => {
    const paymentNeeded = deriveSalesProductionHandoff(
      source({
        membership: {
          ...source().membership!,
          payment_setup_completed_at: null,
          stripe_payment_method_id: null,
        },
        paymentSetupEmailState: "ready",
        paymentHandoffProgress: {
          state: "not_started",
          canSend: true,
          emailSentAt: null,
          expiresAt: null,
        },
        propertyLinked: false,
      }),
    );
    const activationReview = deriveSalesProductionHandoff(
      source({
        membership: {
          ...source().membership!,
          status: "pending_payment",
        },
      }),
    );

    expect(paymentNeeded.stage).toBe("payment_needed");
    expect(paymentNeeded.completedSteps).toBe(1);
    expect(activationReview.stage).toBe("membership_attention");
    expect(activationReview.completedSteps).toBe(2);
  });

  it("withholds the direct payment email until its exact prerequisites are proven", () => {
    const needsEmail = deriveSalesProductionHandoff(
      source({
        membership: {
          ...source().membership!,
          status: "pending_payment",
          payment_setup_completed_at: null,
          stripe_payment_method_id: null,
        },
        paymentSetupEmailState: "needs_email",
        paymentHandoffProgress: {
          state: "not_started",
          canSend: true,
          emailSentAt: null,
          expiresAt: null,
        },
      }),
    );

    expect(needsEmail).toMatchObject({
      stage: "membership_attention",
      paymentSetupEmailState: "needs_email",
      label: "Customer email needed",
      actionLabel: "Add customer email",
    });
    expect(needsEmail.detail).toContain("valid customer email");
  });

  it("separates an active delivered link from owner work and restores action after expiry", () => {
    const membership = {
      ...source().membership!,
      status: "pending_payment",
      payment_setup_completed_at: null,
      stripe_payment_method_id: null,
    };
    const waiting = deriveSalesProductionHandoff(
      source({
        membership,
        paymentSetupEmailState: "ready",
        paymentHandoffProgress: {
          state: "email_sent",
          canSend: false,
          emailSentAt: "2026-08-16T19:30:00.000Z",
          expiresAt: "2026-08-17T19:30:00.000Z",
        },
      }),
    );
    const expired = deriveSalesProductionHandoff(
      source({
        membership,
        paymentSetupEmailState: "ready",
        paymentHandoffProgress: {
          state: "expired",
          canSend: true,
          emailSentAt: "2026-08-15T19:30:00.000Z",
          expiresAt: "2026-08-16T19:30:00.000Z",
        },
      }),
    );

    expect(waiting).toMatchObject({
      stage: "payment_pending",
      presentationId: "presentation-1",
      label: "Waiting on customer card setup",
    });
    expect(expired).toMatchObject({
      stage: "payment_needed",
      label: "Secure card link expired",
      actionLabel: "Recover payment handoff",
    });
  });

  it("walks an active member through property, job, and schedule proof", () => {
    const property = deriveSalesProductionHandoff(
      source({ propertyLinked: false }),
    );
    const job = deriveSalesProductionHandoff(
      source({ recurringJobCount: 0 }),
    );
    expect(property).toMatchObject({
      stage: "property_pairing_needed",
      actionHref:
        "/hq/jobber?membership=membership-1&step=property#jobber-visits",
    });
    expect(job).toMatchObject({
      stage: "job_pairing_needed",
      actionHref: "/hq/jobber?membership=membership-1&step=job#jobber-visits",
    });
    expect(
      deriveSalesProductionHandoff(
        source({ scheduleSourceState: "unavailable" }),
      ).stage,
    ).toBe("source_unavailable");
    expect(
      deriveSalesProductionHandoff(source({ nextScheduledAt: null })).stage,
    ).toBe("schedule_needed");
  });

  it("only calls a close production ready when all five proofs exist", () => {
    const result = deriveSalesProductionHandoff(source());

    expect(result).toMatchObject({
      stage: "ready",
      completedSteps: 5,
      totalSteps: 5,
      nextScheduledAt: "2026-09-01T16:00:00.000Z",
      actionHref: "/hq/customers/membership/membership-1",
    });
    expect(result.detail).toContain("all verified");
  });

  it("summarizes action and unknown-schedule counts without hiding records", () => {
    const ready = deriveSalesProductionHandoff(source());
    const unknown = deriveSalesProductionHandoff(
      source({
        attributionId: "attribution-2",
        scheduleSourceState: "unavailable",
      }),
    );
    const waiting = deriveSalesProductionHandoff(
      source({
        attributionId: "attribution-3",
        membership: {
          ...source().membership!,
          status: "pending_payment",
          payment_setup_completed_at: null,
          stripe_payment_method_id: null,
        },
        paymentSetupEmailState: "ready",
        paymentHandoffProgress: {
          state: "email_sent",
          canSend: false,
          emailSentAt: "2026-08-16T17:30:00.000Z",
          expiresAt: "2026-08-17T17:30:00.000Z",
        },
      }),
    );
    const snapshot = buildSalesProductionHandoffSnapshot({
      generatedAt: "2026-08-14T18:00:00.000Z",
      records: [ready, unknown, waiting],
    });

    expect(snapshot.summary).toEqual({
      signedCount: 3,
      readyCount: 1,
      actionCount: 1,
      waitingCount: 1,
      scheduleUnknownCount: 1,
    });
    expect(snapshot.records).toHaveLength(3);
  });
});
