import { describe, expect, it } from "vitest";
import { canyonOaksHomeCarePlan } from "@/lib/home-care-plan/canyon-oaks";
import { buildPortalCareRecordView } from "./portal-view-model";

describe("buildPortalCareRecordView", () => {
  it("uses Quarterly/Bi-Annual tier labels, not legacy Premium/Essential", () => {
    const view = buildPortalCareRecordView(canyonOaksHomeCarePlan, {
      profile: {
        id: "p1",
        firstName: "Larry",
        lastName: "Buckley",
        email: null,
        phone: null,
        memberSince: "2026-01-15T00:00:00Z",
        membershipTier: "premium",
        membershipStatus: "active",
        totalSaved: 0,
        savingsHistory: [],
        nextAppointment: null,
        appointmentHistory: [],
        propertyId: "prop1",
      },
      property: canyonOaksHomeCarePlan.property as never,
      propertyName: "Canyon Oaks Residence",
      appointments: [],
      nextAppointment: null,
      ytdSavings: { savings: 0, retail: 0, paid: 0 },
      lifetimeSavings: { savings: 0, retail: 0, paid: 0, entries: [] },
      observations: [],
      membershipPlanName: "Quarterly Care",
      monthlyRate: 250,
      memberSince: "2026-01-15T00:00:00Z",
      foundingMember: true,
      foundingMemberSince: "2026-01-15T00:00:00Z",
      salesTier: "quarterly",
      visitPrice: 250,
      visitsPerYear: 4,
      membershipStatus: "active",
      paymentSetupCompletedAt: "2026-01-16T00:00:00Z",
      agreement: {
        planName: "Quarterly Care",
        signedAt: "2026-01-15T00:00:00Z",
        pdfUrl: "https://example.com/agreement.pdf",
      },
      presentationId: "pres-1",
      membershipId: "mem-1",
      paymentMethodLabel: "Visa ···· 4242",
    });

    expect(view.tierMemberLabel).toMatch(/Quarterly Member/);
    expect(view.tierMemberLabel).not.toMatch(/Premium|Essential|Elite/);
    expect(view.landingHeadline).toBe(
      "Larry, Canyon Oaks Residence is under care.",
    );
  });

  it("never fabricates visit history when appointments are empty", () => {
    const view = buildPortalCareRecordView(canyonOaksHomeCarePlan, {
      profile: {
        id: "p1",
        firstName: "Larry",
        lastName: "Buckley",
        email: null,
        phone: null,
        memberSince: "2026-01-15T00:00:00Z",
        membershipTier: "premium",
        membershipStatus: "active",
        totalSaved: 0,
        savingsHistory: [],
        nextAppointment: null,
        appointmentHistory: [],
        propertyId: "prop1",
      },
      property: canyonOaksHomeCarePlan.property as never,
      propertyName: "Canyon Oaks Residence",
      appointments: [],
      nextAppointment: null,
      ytdSavings: { savings: 0, retail: 0, paid: 0 },
      lifetimeSavings: { savings: 0, retail: 0, paid: 0, entries: [] },
      observations: [],
      membershipPlanName: "Quarterly Care",
      monthlyRate: 250,
      memberSince: "2026-01-15T00:00:00Z",
      foundingMember: false,
      foundingMemberSince: null,
      salesTier: "quarterly",
      visitPrice: 250,
      visitsPerYear: 4,
      membershipStatus: "active",
      paymentSetupCompletedAt: "2026-01-16T00:00:00Z",
      agreement: null,
      presentationId: null,
      membershipId: "mem-1",
      paymentMethodLabel: null,
    });

    expect(view.timelineEntries).toHaveLength(0);
    expect(view.completedVisitCount).toBe(0);
    expect(view.showSavings).toBe(false);
    expect(view.savingsLabel).toBeNull();
    expect(view.whatsNextHeadline).toBe("We're scheduling your first visit.");
  });

  it("formats visit price with unit inline (no-narration rule)", () => {
    const view = buildPortalCareRecordView(canyonOaksHomeCarePlan, {
      profile: {
        id: "p1",
        firstName: "Larry",
        lastName: "Buckley",
        email: null,
        phone: null,
        memberSince: "2026-01-15T00:00:00Z",
        membershipTier: "premium",
        membershipStatus: "active",
        totalSaved: 0,
        savingsHistory: [],
        nextAppointment: null,
        appointmentHistory: [],
        propertyId: "prop1",
      },
      property: canyonOaksHomeCarePlan.property as never,
      propertyName: "Canyon Oaks Residence",
      appointments: [],
      nextAppointment: null,
      ytdSavings: { savings: 0, retail: 0, paid: 0 },
      lifetimeSavings: { savings: 0, retail: 0, paid: 0, entries: [] },
      observations: [],
      membershipPlanName: "Quarterly Care",
      monthlyRate: 250,
      memberSince: "2026-01-15T00:00:00Z",
      foundingMember: false,
      foundingMemberSince: null,
      salesTier: "quarterly",
      visitPrice: 250,
      visitsPerYear: 4,
      membershipStatus: "active",
      paymentSetupCompletedAt: "2026-01-16T00:00:00Z",
      agreement: null,
      presentationId: null,
      membershipId: "mem-1",
      paymentMethodLabel: null,
    });

    expect(view.visitPriceLabel).toContain("per visit");
    expect(view.visitPriceLabel).toMatch(/\$/);
  });
});
