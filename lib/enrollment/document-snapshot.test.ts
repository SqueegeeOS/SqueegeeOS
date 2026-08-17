import { describe, expect, it } from "vitest";
import { createDefaultCarePlan } from "@/lib/presentations/care-plan";
import type { PresentationData } from "@/lib/presentations/types";
import {
  buildEnrollmentDocumentSnapshot,
  enrollmentScopePlainText,
} from "./document-snapshot";

function presentation(): PresentationData {
  const carePlan = createDefaultCarePlan({ tier: "quarterly" });
  carePlan.summary = "Exterior every visit, annual interior, screens by request.";
  carePlan.visits[0] = {
    ...carePlan.visits[0]!,
    interiorWindows: "included",
    screens: "optional",
    notes: "Confirm gate code before arrival.",
  };
  for (let index = 1; index < carePlan.visits.length; index += 1) {
    carePlan.visits[index] = {
      ...carePlan.visits[index]!,
      screens: "optional",
    };
  }
  return {
    id: "00000000-0000-4000-8000-000000000066",
    createdBy: "homeatlas_hq",
    salesRepId: null,
    salesRepLeadId: null,
    leadIntakeId: null,
    clientName: "  Mandi Homeowner  ",
    clientAddress: "1420 Davis Street, Chico, CA 95928-1234",
    clientPhone: "530-555-0142",
    clientEmail: " MANDI@EXAMPLE.COM ",
    homeSqft: 2450,
    twoStory: true,
    includeScreens: false,
    includeInterior: false,
    planMode: "custom",
    presentationLayout: "signature",
    carePlan,
    tier: "quarterly",
    monthlyRate: 200,
    overrideTier: "quarterly",
    visitRateOverrides: { quarterly: 200 },
    annualRate: 900,
    retailValue: 0,
    enrollmentSavings: 0,
    customNotes: "",
    quoteSnapshot: null,
    slideOverrides: {},
    status: "draft",
    signedAt: null,
    agreementId: null,
    homeownerId: null,
    propertyId: null,
    membershipId: null,
    onboardingStatus: null,
    createdAt: "2026-08-15T12:00:00.000Z",
    updatedAt: "2026-08-15T12:00:00.000Z",
  };
}

describe("attorney-controlled enrollment snapshot", () => {
  it("freezes customer, property, first rate, recurring rate, and visit scope", () => {
    const snapshot = buildEnrollmentDocumentSnapshot({
      presentation: presentation(),
      tier: "quarterly",
      firstVisitPrice: 275,
      recurringVisitPrice: 200,
      annualizedValue: 900,
      salesContext: "customer_home",
      homeSolicitationNoticeDays: 3,
      paymentRail: "stripe_card",
      createdAt: "2026-08-15T12:30:00.000Z",
    });

    expect(snapshot.customer).toMatchObject({
      name: "Mandi Homeowner",
      email: "mandi@example.com",
    });
    expect(snapshot.property.fullAddress).toContain("95928-1234");
    expect(snapshot.plan.firstVisitPriceCents).toBe(27_500);
    expect(snapshot.plan.recurringVisitPriceCents).toBe(20_000);
    expect(snapshot.plan.annualizedValueCents).toBe(90_000);
    expect(snapshot.plan.visits[0]).toMatchObject({
      interiorWindows: "included",
      screens: "optional",
      notes: "Confirm gate code before arrival.",
    });
    expect(snapshot.disclosures.homeSolicitationNoticeDays).toBe(3);
    expect(snapshot.disclosures.rateChangeSummary).toContain(
      "first-visit and continuing rates",
    );
    expect(snapshot.disclosures.billingSummary).toContain(
      "all SqueegeeKing jobs and visits scheduled",
    );
    expect(snapshot.disclosures.billingConsent).toContain(
      "automatically charge the variable total",
    );
    expect(enrollmentScopePlainText(snapshot)).toContain("Screens: Optional");
  });

  it("fails closed when a customer-home sale lacks its cancellation lane", () => {
    expect(() =>
      buildEnrollmentDocumentSnapshot({
        presentation: presentation(),
        tier: "quarterly",
        firstVisitPrice: 275,
        recurringVisitPrice: 200,
        annualizedValue: 900,
        salesContext: "customer_home",
        homeSolicitationNoticeDays: null,
        paymentRail: "stripe_card",
      }),
    ).toThrow(/3-day or senior 5-day/);
  });

  it("does not attach a home-solicitation notice to remote enrollment", () => {
    expect(() =>
      buildEnrollmentDocumentSnapshot({
        presentation: presentation(),
        tier: "quarterly",
        firstVisitPrice: 275,
        recurringVisitPrice: 200,
        annualizedValue: 900,
        salesContext: "remote",
        homeSolicitationNoticeDays: 3,
        paymentRail: "stripe_card",
      }),
    ).toThrow(/only valid for a customer-home sale/);
  });

  it("freezes an owner-approved cash or check arrangement without card authorization", () => {
    const snapshot = buildEnrollmentDocumentSnapshot({
      presentation: presentation(),
      tier: "quarterly",
      firstVisitPrice: 275,
      recurringVisitPrice: 200,
      annualizedValue: 900,
      salesContext: "remote",
      homeSolicitationNoticeDays: null,
      paymentRail: "manual_cash_check",
    });

    expect(snapshot.schemaVersion).toBe(2);
    expect(snapshot.payment).toMatchObject({ rail: "manual_cash_check" });
    expect(snapshot.disclosures.billingSummary).toContain("cash or check");
    expect(snapshot.disclosures.billingConsent).toContain(
      "not authorized for automatic card charges",
    );
  });
});
