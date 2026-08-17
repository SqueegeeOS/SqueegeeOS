import { describe, expect, it } from "vitest";
import {
  automaticBillingBlockingReasons,
  automaticBillingMonthBounds,
  automaticBillingOperationKey,
  automaticBillingRetryAt,
  automaticBillingServiceMonth,
  canAttemptAutomaticBillingCharge,
  dollarsToBillingCents,
  findUniqueCoveringObligation,
} from "./automatic-billing-rules";

const membership = {
  id: "membership-1",
  status: "active",
  agreementId: "agreement-1",
  paymentSetupCompletedAt: "2026-01-10T12:00:00.000Z",
  stripeCustomerId: "cus_123",
  stripePaymentMethodId: "pm_123",
  visitPrice: 250,
  automaticBillingEnabled: true,
  paymentRail: "stripe_card" as const,
  billingAuthorizationIssues: [],
};

const appointment = {
  id: "appointment-1",
  provider: "jobber",
  externalId: "visit-1",
  scheduledAt: "2026-08-15T17:00:00.000Z",
  status: "scheduled",
  provenanceState: "provider_imported",
  verificationState: "verified",
  matchState: "matched",
  jobberBillingVerified: true,
};

describe("automatic membership billing rules", () => {
  it("uses the Pacific service month at UTC boundaries", () => {
    expect(automaticBillingServiceMonth("2026-08-01T06:30:00.000Z")).toBe(
      "2026-07-01",
    );
    expect(automaticBillingServiceMonth("2026-08-01T07:30:00.000Z")).toBe(
      "2026-08-01",
    );
  });

  it("builds DST-aware current-month bounds", () => {
    const bounds = automaticBillingMonthBounds(
      new Date("2026-08-15T18:00:00.000Z"),
    );
    expect(bounds.serviceMonth).toBe("2026-08-01");
    expect(bounds.startUtc.toISOString()).toBe("2026-08-01T07:00:00.000Z");
    expect(bounds.endUtc.toISOString()).toBe("2026-09-01T07:00:00.000Z");
  });

  it("requires signed, active, card-ready membership and verified Jobber truth", () => {
    expect(
      automaticBillingBlockingReasons({
        membership,
        appointment,
        serviceMonth: "2026-08-01",
      }),
    ).toEqual([]);
    expect(
      automaticBillingBlockingReasons({
        membership: {
          ...membership,
          agreementId: null,
          automaticBillingEnabled: false,
          billingAuthorizationIssues: ["signed_agreement_required"],
        },
        appointment: { ...appointment, verificationState: "unverified" },
        serviceMonth: "2026-08-01",
      }),
    ).toEqual([
      "signed_agreement_required",
      "membership_automatic_billing_paused",
      "appointment_not_verified",
    ]);
    expect(
      automaticBillingBlockingReasons({
        membership: {
          ...membership,
          paymentRail: "manual_cash_check",
          automaticBillingEnabled: false,
        },
        appointment,
        serviceMonth: "2026-08-01",
      }),
    ).toContain("membership_payment_rail_not_stripe");
  });

  it("creates a stable per-membership service-month operation key", () => {
    expect(
      automaticBillingOperationKey(
        "membership 1",
        "2026-08-01",
        "visit-1",
        "2026-08-15T17:00:00.000Z",
      ),
    ).toMatch(
      /^homeatlas:membership:membership%201:service-month:2026-08-01:visit:[a-f0-9]{24}:automatic-billing:v2$/,
    );
    expect(
      automaticBillingOperationKey(
        "membership 1",
        "2026-08-01",
        "visit-1",
        "2026-08-16T17:00:00.000Z",
      ),
    ).not.toBe(
      automaticBillingOperationKey(
        "membership 1",
        "2026-08-01",
        "visit-1",
        "2026-08-15T17:00:00.000Z",
      ),
    );
  });

  it("spaces automatic retries and caps unattended attempts", () => {
    const attemptedAt = new Date("2026-08-01T17:00:00.000Z");
    expect(automaticBillingRetryAt(attemptedAt, 1)).toBe(
      "2026-08-04T17:00:00.000Z",
    );
    expect(automaticBillingRetryAt(attemptedAt, 3)).toBeNull();
    expect(
      canAttemptAutomaticBillingCharge({
        status: "failed",
        attemptCount: 1,
        nextRetryAt: "2026-08-04T17:00:00.000Z",
        now: new Date("2026-08-03T17:00:00.000Z"),
      }),
    ).toBe(false);
    expect(
      canAttemptAutomaticBillingCharge({
        status: "failed",
        attemptCount: 3,
        nextRetryAt: null,
        now: new Date("2026-08-10T17:00:00.000Z"),
        forceRetry: true,
      }),
    ).toBe(true);
  });

  it("converts the signed dollar price to cents", () => {
    expect(dollarsToBillingCents(249.99)).toBe(24999);
  });

  it("binds only one obligation whose window covers the verified visit", () => {
    const obligation = {
      id: "obligation-1",
      membershipId: "membership-1",
      propertyId: "property-1",
      targetWindowStart: "2026-08-01",
      targetWindowEnd: "2026-08-31",
      status: "promised",
    };
    expect(
      findUniqueCoveringObligation({
        obligations: [obligation],
        membershipId: "membership-1",
        propertyId: "property-1",
        scheduledAt: appointment.scheduledAt,
      }),
    ).toEqual(obligation);
    expect(
      findUniqueCoveringObligation({
        obligations: [obligation, { ...obligation, id: "obligation-2" }],
        membershipId: "membership-1",
        propertyId: "property-1",
        scheduledAt: appointment.scheduledAt,
      }),
    ).toBeNull();
  });
});
