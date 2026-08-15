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
      sales_tier: "quarterly",
      visit_price: 300,
      visits_per_year: 4,
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

  it("walks an active member through property, job, and schedule proof", () => {
    expect(
      deriveSalesProductionHandoff(source({ propertyLinked: false })).stage,
    ).toBe("property_pairing_needed");
    expect(
      deriveSalesProductionHandoff(source({ recurringJobCount: 0 })).stage,
    ).toBe("job_pairing_needed");
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
    const snapshot = buildSalesProductionHandoffSnapshot({
      generatedAt: "2026-08-14T18:00:00.000Z",
      records: [ready, unknown],
    });

    expect(snapshot.summary).toEqual({
      signedCount: 2,
      readyCount: 1,
      actionCount: 1,
      scheduleUnknownCount: 1,
    });
    expect(snapshot.records).toHaveLength(2);
  });
});
