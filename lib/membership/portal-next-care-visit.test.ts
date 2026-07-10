import { describe, expect, it } from "vitest";
import { buildPortalNextCareVisit } from "./portal-next-care-visit";

describe("buildPortalNextCareVisit", () => {
  it("shows preparing copy when membership is not active yet", () => {
    const visit = buildPortalNextCareVisit({
      membershipActive: false,
      nextAppointment: null,
      cadence: "quarterly",
    });

    expect(visit.hasScheduledVisit).toBe(false);
    expect(visit.emptyCopy).toBe("We're preparing your next care visit.");
    expect(visit.serviceTypeLabel).toBe("Quarterly Home Care Visit");
  });

  it("shows scheduling copy for active members without an appointment", () => {
    const visit = buildPortalNextCareVisit({
      membershipActive: true,
      nextAppointment: null,
      cadence: "quarterly",
    });

    expect(visit.hasScheduledVisit).toBe(false);
    expect(visit.emptyCopy).toBe("Your next care visit is being scheduled.");
  });

  it("shows real scheduled visit details from member appointments", () => {
    const visit = buildPortalNextCareVisit({
      membershipActive: true,
      nextAppointment: {
        id: "appt-1",
        date: "2026-08-15T09:00:00.000Z",
        serviceType: "home_care_visit",
        status: "scheduled",
        technician: null,
        notes: "Time window: Morning · 8am–12pm",
      },
      cadence: "biannual",
    });

    expect(visit.hasScheduledVisit).toBe(true);
    expect(visit.dateShortLabel).toBe("August 15");
    expect(visit.dateLabel).toContain("August");
    expect(visit.dateLabel).toContain("15");
    expect(visit.timeWindow).toBe("Morning · 8am–12pm");
    expect(visit.serviceTypeLabel).toBe("Bi-Annual Exterior Window Care");
    expect(visit.reassuranceCopy).toContain("HomeAtlas care visit is scheduled");
    expect(visit.heroSupportCopy).toBe(
      "Your home's next scheduled care visit is set.",
    );
  });
});
