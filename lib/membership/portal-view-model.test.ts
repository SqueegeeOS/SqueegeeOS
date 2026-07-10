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
      paymentMethodLabel: "Bank account ···· 6789",
      membershipEnrollmentSavings: 150,
    });

    expect(view.tierMemberLabel).toMatch(/Quarterly Member/);
    expect(view.paymentOnFile).toBe(true);
    expect(view.pendingPayment).toBe(false);
    expect(view.paymentHeadline).toBe("Bank account ···· 6789");
    expect(view.tierMemberLabel).not.toMatch(/Premium|Essential|Elite/);
    expect(view.showHomeAtlasJourney).toBe(true);
    expect(view.membershipTierCareLabel).toBe("Quarterly Care");
    expect(view.membershipEnrollmentSavings).toBe(150);
    expect(view.membershipSavingsTotal).toBe(0);
    expect(view.landingHeadline).toBe(
      "Larry, your home is under care.",
    );
    expect(view.propertyAddress).not.toMatch(/TBD/i);
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
    expect(view.whatsNextHeadline).toBe(
      "Your next care visit is being scheduled.",
    );
    expect(view.nextCareVisit.hasScheduledVisit).toBe(false);
    expect(view.nextCareVisit.emptyCopy).toBe(
      "Your next care visit is being scheduled.",
    );
  });

  it("shows Next Care Visit when a real appointment is scheduled", () => {
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
        nextAppointment: {
          id: "appt-1",
          date: "2026-08-15T09:00:00.000Z",
          serviceType: "home_care_visit",
          status: "scheduled",
          technician: null,
          notes: "Time window: Morning · 8am–12pm",
        },
        appointmentHistory: [],
        propertyId: "prop1",
      },
      property: canyonOaksHomeCarePlan.property as never,
      propertyName: "Canyon Oaks Residence",
      appointments: [],
      nextAppointment: {
        id: "appt-1",
        date: "2026-08-15T09:00:00.000Z",
        serviceType: "home_care_visit",
        status: "scheduled",
        technician: null,
        notes: "Time window: Morning · 8am–12pm",
      },
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

    expect(view.whatsNextHeadline).toBe("Next Care Visit — August 15");
    expect(view.nextCareVisit.hasScheduledVisit).toBe(true);
    expect(view.nextCareVisit.serviceTypeLabel).toBe("Quarterly Home Care Visit");
    expect(view.nextCareVisit.timeWindow).toBe("Morning · 8am–12pm");
    expect(view.nextCareVisit.dateShortLabel).toBe("August 15");
    expect(view.nextCareVisit.heroSupportCopy).toBe(
      "Your home's next scheduled care visit is set.",
    );
  });

  it("hides TBD from the customer-facing property address", () => {
    const view = buildPortalCareRecordView(canyonOaksHomeCarePlan, {
      profile: {
        id: "p1",
        firstName: "Sylvia",
        lastName: "Siegel",
        email: null,
        phone: null,
        memberSince: "2026-07-09T00:00:00Z",
        membershipTier: "premium",
        membershipStatus: "active",
        totalSaved: 0,
        savingsHistory: [],
        nextAppointment: null,
        appointmentHistory: [],
        propertyId: "prop1",
      },
      property: {
        ...canyonOaksHomeCarePlan.property,
        address: "366 brookside Drive",
        city: "TBD",
        state: "CA",
        zip: "",
      } as never,
      propertyName: "366 Brookside Drive",
      appointments: [],
      nextAppointment: null,
      ytdSavings: { savings: 0, retail: 0, paid: 0 },
      lifetimeSavings: { savings: 0, retail: 0, paid: 0, entries: [] },
      observations: [],
      membershipPlanName: "Bi-Annual Care",
      monthlyRate: 300,
      memberSince: "2026-07-09T00:00:00Z",
      foundingMember: false,
      foundingMemberSince: null,
      salesTier: "biannual",
      visitPrice: 300,
      visitsPerYear: 2,
      membershipStatus: "active",
      paymentSetupCompletedAt: "2026-07-09T18:00:36.884+00:00",
      agreement: null,
      presentationId: null,
      membershipId: "mem-1",
      paymentMethodLabel: null,
    });

    expect(view.propertyAddress).toBe("366 Brookside Drive");
    expect(view.landingHeadline).toBe("Sylvia, your home is under care.");
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

  it("multiplies locked enrollment savings by completed visits only", () => {
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
      appointments: [
        {
          id: "a1",
          date: "2026-02-01T00:00:00Z",
          serviceType: "window_cleaning",
          status: "completed",
          technician: null,
          notes: null,
        },
        {
          id: "a2",
          date: "2026-03-01T00:00:00Z",
          serviceType: "window_cleaning",
          status: "scheduled",
          technician: null,
          notes: null,
        },
      ],
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
      membershipEnrollmentSavings: 100,
    });

    expect(view.completedVisitCount).toBe(1);
    expect(view.membershipSavingsTotal).toBe(100);
  });

  it("uses agreement plan name when sales tier is unavailable", () => {
    const view = buildPortalCareRecordView(canyonOaksHomeCarePlan, {
      profile: {
        id: "p1",
        firstName: "Sylvia",
        lastName: "Siegel",
        email: null,
        phone: null,
        memberSince: "2026-07-09T00:00:00Z",
        membershipTier: "premium",
        membershipStatus: "active",
        totalSaved: 0,
        savingsHistory: [],
        nextAppointment: null,
        appointmentHistory: [],
        propertyId: "prop1",
      },
      property: canyonOaksHomeCarePlan.property as never,
      propertyName: "366 Brookside Drive",
      appointments: [],
      nextAppointment: null,
      ytdSavings: { savings: 0, retail: 0, paid: 0 },
      lifetimeSavings: { savings: 0, retail: 0, paid: 0, entries: [] },
      observations: [],
      membershipPlanName: "Preferred Care",
      monthlyRate: 300,
      memberSince: "2026-07-09T00:00:00Z",
      foundingMember: true,
      foundingMemberSince: "2026-07-09T00:00:00Z",
      salesTier: null,
      visitPrice: 300,
      visitsPerYear: 2,
      membershipStatus: "active",
      paymentSetupCompletedAt: "2026-07-09T18:00:36.884+00:00",
      agreement: {
        planName: "SqueegeeKing Bi-Annual Home Care Membership",
        signedAt: "2026-07-09T17:58:43.35+00:00",
        pdfUrl: null,
      },
      presentationId: "pres-1",
      membershipId: "mem-1",
      paymentMethodLabel: "Visa ···· 4242",
      membershipEnrollmentSavings: null,
    });

    expect(view.tierMemberLabel).toBe("Bi-Annual Member");
    expect(view.membershipTierCareLabel).toBe("Bi-Annual Care");
    expect(view.paymentOnFile).toBe(true);
  });
});
