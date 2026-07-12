import { describe, expect, it } from "vitest";
import { DEFAULT_COMPANY_SETTINGS } from "@/lib/pricing/company-settings";
import {
  assertBillingExecutionDisabled,
  buildBillingPreview,
  type BillingPreviewInput,
} from "./billing-preview";
import {
  canAppearAsProviderConfirmed,
  classifyExistingAppointment,
  HOMEATLAS_NATIVE_SCHEDULING_ENABLED,
  type AppointmentProvenance,
} from "./model";
import { createAtlasPricingSnapshotDraft } from "./pricing-snapshot";
import { deduplicateStripeEvents, reconcilePaymentTruth } from "./stripe-reconciliation";

const verifiedAppointment: AppointmentProvenance = {
  provider: "jobber",
  externalId: "visit_123",
  provenanceState: "provider_imported",
  verificationState: "verified",
  matchState: "matched",
};

function previewInput(overrides: Partial<BillingPreviewInput> = {}): BillingPreviewInput {
  return {
    obligationId: "obligation-1",
    appointmentId: "appointment-1",
    appointment: verifiedAppointment,
    pricingSnapshotId: "snapshot-1",
    authorizedChargeCents: 25000,
    creditAppliedCents: 0,
    stripeCustomerReady: true,
    stripePaymentMethodReady: true,
    serviceMonth: "2026-08-01",
    scheduledServiceAt: "2026-08-12T16:00:00.000Z",
    ...overrides,
  };
}

describe("appointment provenance", () => {
  it("keeps HomeAtlas native scheduling disabled during Jobber authority", () => {
    expect(HOMEATLAS_NATIVE_SCHEDULING_ENABLED).toBe(false);
  });

  it("classifies every existing appointment as legacy and unverified", () => {
    const legacy = classifyExistingAppointment();
    expect(legacy.provenanceState).toBe("homeatlas_legacy_unverified");
    expect(canAppearAsProviderConfirmed(legacy)).toBe(false);
  });

  it("accepts a manually verified legacy appointment only with Jobber identity", () => {
    expect(canAppearAsProviderConfirmed({
      ...verifiedAppointment,
      provenanceState: "manually_verified",
    })).toBe(true);
    expect(canAppearAsProviderConfirmed({
      ...verifiedAppointment,
      provider: null,
      externalId: null,
      provenanceState: "manually_verified",
    })).toBe(false);
  });

  it("keeps ambiguous provider records out of confirmed views", () => {
    expect(canAppearAsProviderConfirmed({
      ...verifiedAppointment,
      matchState: "unmatched",
    })).toBe(false);
  });
});

describe("billing preview safety", () => {
  it("prevents an unverified appointment from billing", () => {
    const preview = buildBillingPreview(previewInput({
      appointment: classifyExistingAppointment(),
    }));
    expect(preview.billable).toBe(false);
    expect(preview.blockingReasons).toContain("appointment_not_verified_provider_truth");
  });

  it("prevents billing without an immutable pricing snapshot", () => {
    const preview = buildBillingPreview(previewInput({ pricingSnapshotId: null }));
    expect(preview.billable).toBe(false);
    expect(preview.blockingReasons).toContain("immutable_pricing_snapshot_required");
  });

  it("supports multiple visits in one month as distinct obligation/appointment plans", () => {
    const first = buildBillingPreview(previewInput());
    const second = buildBillingPreview(previewInput({
      obligationId: "obligation-2",
      appointmentId: "appointment-2",
      scheduledServiceAt: "2026-08-26T16:00:00.000Z",
    }));
    expect(first.billable).toBe(true);
    expect(second.billable).toBe(true);
  });

  it("hard-disables execution even for a billable preview", () => {
    expect(buildBillingPreview(previewInput()).executionEnabled).toBe(false);
    expect(() => assertBillingExecutionDisabled()).toThrow("disabled");
  });

  it("validates the service month in Pacific time at a UTC month boundary", () => {
    const augustVisit = buildBillingPreview(previewInput({
      serviceMonth: "2026-08-01",
      scheduledServiceAt: "2026-09-01T06:30:00.000Z",
    }));
    const wrongMonth = buildBillingPreview(previewInput({
      serviceMonth: "2026-09-01",
      scheduledServiceAt: "2026-09-01T06:30:00.000Z",
    }));

    expect(augustVisit.blockingReasons).not.toContain("service_month_visit_mismatch");
    expect(wrongMonth.blockingReasons).toContain("service_month_visit_mismatch");
  });

  it("blocks an invalid visit timestamp", () => {
    const preview = buildBillingPreview(previewInput({ scheduledServiceAt: "not-a-date" }));
    expect(preview.blockingReasons).toContain("invalid_scheduled_service_at");
  });
});

describe("immutable Atlas pricing snapshot draft", () => {
  it("derives the authorized amount from engine output", () => {
    const snapshot = createAtlasPricingSnapshotDraft({
      pricingInput: {
        squareFeet: 2500,
        frequency: "quarterly",
        includeInterior: false,
        includeScreens: true,
        twoStory: true,
      },
      companySettings: DEFAULT_COMPANY_SETTINGS,
      companySettingsVersion: "defaults-2026-07-04",
    });
    expect(snapshot.authorizedChargeCents).toBe(
      snapshot.lineItemOutput.exteriorMemberPrice * 100,
    );
    expect(snapshot.companySettingsHash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("Stripe idempotency and reconciliation", () => {
  it("deduplicates duplicate webhook delivery by Stripe event ID", () => {
    const event = { id: "evt_1", type: "payment_intent.succeeded", objectId: "pi_1", payloadHash: "abc" };
    expect(deduplicateStripeEvents([event, event])).toEqual([event]);
  });

  it("flags Stripe paid with missing local payment", () => {
    expect(reconcilePaymentTruth({ stripePaid: true, localPaid: false }))
      .toBe("stripe_paid_local_missing");
  });

  it("flags local paid with missing Stripe payment", () => {
    expect(reconcilePaymentTruth({ stripePaid: false, localPaid: true }))
      .toBe("local_paid_stripe_missing");
  });
});
