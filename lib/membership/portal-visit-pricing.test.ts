import { describe, expect, it } from "vitest";
import { canyonOaksHomeCarePlan } from "@/lib/home-care-plan/canyon-oaks";
import type { MemberPortalData } from "@/lib/persistence/queries/member-portal";
import { buildPortalCareRecordView } from "./portal-view-model";
import { signedPortalVisitPricing } from "./portal-visit-pricing";

const snapshot = {
  plan: {
    visitsPerYear: 4,
    annualizedValueCents: 160000,
    recurringVisitPriceCents: 40000,
    visits: [30000, 50000, 30000, 50000].map((priceCents) => ({
      priceCents,
      solarPanels: "included",
      exteriorWindows: priceCents === 50000 ? "included" : "not_included",
      screens: priceCents === 50000 ? "included" : "not_included",
      interiorWindows: "optional",
      cobwebRemoval: "optional",
    })),
  },
};

function portalData(): MemberPortalData {
  return {
    profile: {
      id: "profile-1", firstName: "Member", lastName: "Test", email: null,
      phone: null, memberSince: "2026-08-28T00:00:00Z", membershipTier: "premium",
      membershipStatus: "active", totalSaved: 0, savingsHistory: [],
      nextAppointment: null, appointmentHistory: [], propertyId: "property-1",
    },
    property: canyonOaksHomeCarePlan.property as never,
    propertyName: "Test home", appointments: [], nextAppointment: null,
    ytdSavings: { savings: 0, retail: 0, paid: 0 },
    lifetimeSavings: { savings: 0, retail: 0, paid: 0, entries: [] },
    observations: [], membershipPlanName: "Quarterly care", monthlyRate: 400,
    memberSince: "2026-08-28T00:00:00Z", foundingMember: false,
    foundingMemberSince: null, salesTier: "quarterly", visitPrice: 400,
    visitsPerYear: 4, membershipStatus: "active", paymentSetupCompletedAt: null,
    membershipEnrollmentSavings: null,
    paymentRail: "manual_cash_check", manualPaymentApprovedAt: "2026-08-28T00:00:00Z",
    manualPaymentApprovedBy: "hq",
    agreement: {
      planName: "Quarterly care", signedAt: "2026-08-28T00:00:00Z", pdfUrl: null,
      visitPricing: signedPortalVisitPricing(snapshot, 4),
    },
    presentationId: "presentation-1", membershipId: "membership-1",
    portalTheme: null, paymentMethodLabel: "Cash or check account", careAddons: [],
    savingsLedger: null, liveService: null,
  };
}

describe("signed portal visit pricing", () => {
  it("preserves each signed price and both service scopes, not the average", () => {
    const pricing = signedPortalVisitPricing(snapshot, 4);
    expect(pricing?.visits.map((visit) => visit.priceCents)).toEqual([30000, 50000, 30000, 50000]);
    expect(pricing?.annualTotalCents).toBe(160000);
    expect(pricing?.visits[0].serviceSummary).toBe("Solar panel cleaning");
    expect(pricing?.visits[1].serviceSummary).toBe("Solar panel cleaning + exterior window cleaning + standard window-screen cleaning");
    expect(JSON.stringify(pricing)).not.toContain("optional");
  });

  it("does not infer visit charges from missing or inconsistent signed schedules", () => {
    expect(signedPortalVisitPricing(null, 4)).toBeNull();
    expect(signedPortalVisitPricing(snapshot, 2)).toBeNull();
    expect(signedPortalVisitPricing({ plan: { ...snapshot.plan, annualizedValueCents: 120000 } }, 4)).toBeNull();
    expect(signedPortalVisitPricing({ plan: { ...snapshot.plan, visits: [{ priceCents: "30000" }] } }, 1)).toBeNull();
    expect(signedPortalVisitPricing({ plan: { ...snapshot.plan, visits: [{ priceCents: -30000 }] } }, 1)).toBeNull();
  });

  it("preserves the included exterior-window default for legacy snapshots", () => {
    const legacy = structuredClone(snapshot);
    for (const visit of legacy.plan.visits) {
      Reflect.deleteProperty(visit, "exteriorWindows");
    }
    const pricing = signedPortalVisitPricing(legacy, 4);
    expect(pricing?.visits[0].serviceSummary).toContain("exterior window cleaning");
    expect(pricing?.annualTotalCents).toBe(160000);
  });

  it("shows alternating prices, complete scope and annual math with cash/check copy", () => {
    const data = portalData();
    const view = buildPortalCareRecordView(canyonOaksHomeCarePlan, data);
    expect(view.visitPriceLabel).toBe("$300 / $500 · per visit");
    expect(view.annualMathLabel).toBe("$300 + $500 + $300 + $500 = $1,600/year");
    expect(view.plannedVisitLabels).toHaveLength(4);
    expect(view.plannedVisitLabels[0]).toBe("Visit 1: Solar panel cleaning · $300");
    expect(view.plannedVisitLabels[1]).toContain("standard window-screen cleaning · $500");
    expect(view.membershipActive).toBe(true);
    expect(view.pendingPayment).toBe(false);
    expect(view.paymentHeadline).toBe("Cash or check account");
    expect(view.paymentSupport).toBe("Pay by cash or check after each completed service.");
    expect(view.showUpdatePaymentMethod).toBe(false);
    expect(view.billingReminder).toContain("Automatic card billing is disabled");
    expect(view.billingBullets.join(" ")).not.toMatch(/1st|when we arrive/);
    expect(data.visitPrice).toBe(400);
    expect(snapshot.plan.recurringVisitPriceCents).toBe(40000);
  });

  it("preserves flat-price card membership presentation", () => {
    const data = portalData();
    data.agreement = null;
    data.paymentRail = "stripe_card";
    data.paymentSetupCompletedAt = "2026-08-28T00:00:00Z";
    data.paymentMethodLabel = "Visa ···· 4242";
    const view = buildPortalCareRecordView(canyonOaksHomeCarePlan, data);
    expect(view.visitPriceLabel).toBe("$400 · per visit");
    expect(view.annualMathLabel).toBe("$400 × 4 visits = $1,600/year");
    expect(view.plannedVisitLabels).toEqual([]);
    expect(view.billingReminder).toContain("Your card is charged on the 1st");
    expect(view.showUpdatePaymentMethod).toBe(true);
  });
});
