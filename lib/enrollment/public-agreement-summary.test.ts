import { describe, expect, it } from "vitest";
import type { EnrollmentDocumentSnapshot } from "./types";
import { buildPublicEnrollmentAgreementSummary } from "./public-agreement-summary";

const snapshot: EnrollmentDocumentSnapshot = {
  schemaVersion: 2,
  presentationId: "00000000-0000-4000-8000-000000000099",
  customer: { name: "Michael Riley", email: "michael@example.com", phone: null },
  property: { fullAddress: "Riley Residence", squareFeet: null, twoStory: false },
  plan: {
    tier: "quarterly",
    tierLabel: "Quarterly",
    cadence: "4 visits per year",
    visitsPerYear: 4,
    firstVisitPriceCents: 30_000,
    recurringVisitPriceCents: 30_000,
    annualizedValueCents: 160_000,
    addonDiscountPercent: 0,
    summary: "Alternating solar-only and solar-plus-window visits.",
    customerChoiceNote: "Options are added only when requested.",
    visits: [
      {
        label: "Visit 1",
        timing: "First quarterly visit",
        priceCents: 30_000,
        exteriorWindows: "not_included",
        interiorWindows: "optional",
        screens: "not_included",
        cobwebRemoval: "optional",
        solarPanels: "included",
        pressureWashing: "not_included",
        notes: "",
      },
      {
        label: "Visit 2",
        timing: "Second quarterly visit",
        priceCents: 50_000,
        exteriorWindows: "included",
        interiorWindows: "optional",
        screens: "included",
        cobwebRemoval: "optional",
        solarPanels: "included",
        pressureWashing: "not_included",
        notes: "",
      },
      {
        label: "Visit 3",
        timing: "Third quarterly visit",
        priceCents: 30_000,
        exteriorWindows: "not_included",
        interiorWindows: "optional",
        screens: "not_included",
        cobwebRemoval: "optional",
        solarPanels: "included",
        pressureWashing: "not_included",
        notes: "",
      },
      {
        label: "Visit 4",
        timing: "Fourth quarterly visit",
        priceCents: 50_000,
        exteriorWindows: "included",
        interiorWindows: "optional",
        screens: "included",
        cobwebRemoval: "optional",
        solarPanels: "included",
        pressureWashing: "not_included",
        notes: "",
      },
    ],
  },
  payment: {
    rail: "manual_cash_check",
    arrangementSummary: "Cash or check. No automatic card billing.",
  },
  disclosures: {
    salesContext: "remote",
    homeSolicitationNoticeDays: null,
    renewalSummary: "",
    cancellationSummary: "",
    rateChangeSummary: "",
    billingSummary: "",
    billingConsent: "",
  },
  createdAt: "2026-08-24T00:00:00.000Z",
};

describe("public enrollment agreement summary", () => {
  it("keeps exact visit scope and pricing while separating optional services", () => {
    const result = buildPublicEnrollmentAgreementSummary(
      snapshot,
      "manual_cash_check",
    );

    expect(result.annualTotalCents).toBe(160_000);
    expect(result.visits.map((visit) => visit.priceCents)).toEqual([
      30_000,
      50_000,
      30_000,
      50_000,
    ]);
    expect(result.visits[0]?.includedServices).toEqual([
      "Solar panel cleaning",
    ]);
    expect(result.visits[1]?.includedServices).toEqual([
      "Exterior window cleaning",
      "Standard window-screen cleaning",
      "Solar panel cleaning",
    ]);
    expect(result.optionalAddOns.map((option) => option.label)).toEqual([
      "Interior window cleaning",
      "Exterior cobweb removal",
    ]);
    expect(result.paymentSummary).toContain("No automatic card billing");
  });
});
