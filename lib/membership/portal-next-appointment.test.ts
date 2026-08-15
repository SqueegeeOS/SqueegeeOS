import { describe, expect, it } from "vitest";
import type { MemberAppointmentSummary } from "@/lib/member-intelligence/types";
import {
  portalAppointmentLowerBoundIso,
  selectNextScheduledPortalAppointment,
} from "./portal-next-appointment";

function appointment(
  id: string,
  date: string,
  status: MemberAppointmentSummary["status"] = "scheduled",
): MemberAppointmentSummary {
  return {
    id,
    date,
    status,
    serviceType: "home_care_visit",
    technician: null,
    notes: null,
  };
}

describe("portal next appointment truth", () => {
  const afternoonInChico = new Date("2026-08-14T22:00:00.000Z");

  it("chooses the nearest scheduled visit from today or the future", () => {
    const result = selectNextScheduledPortalAppointment(
      [
        appointment("later", "2026-08-18T16:00:00.000Z"),
        appointment("today", "2026-08-14T16:00:00.000Z"),
        appointment("tomorrow", "2026-08-15T16:00:00.000Z"),
      ],
      afternoonInChico,
    );

    expect(result?.id).toBe("today");
  });

  it("keeps a same-day visit visible after its start time", () => {
    const result = selectNextScheduledPortalAppointment(
      [appointment("morning", "2026-08-14T15:00:00.000Z")],
      afternoonInChico,
    );

    expect(result?.id).toBe("morning");
  });

  it("never calls a stale prior-day scheduled record the next visit", () => {
    const result = selectNextScheduledPortalAppointment(
      [appointment("stale", "2026-08-13T23:00:00.000Z")],
      afternoonInChico,
    );

    expect(result).toBeNull();
  });

  it("ignores completed, cancelled, no-show, and invalid records", () => {
    const result = selectNextScheduledPortalAppointment(
      [
        appointment("completed", "2026-08-15T16:00:00.000Z", "completed"),
        appointment("cancelled", "2026-08-16T16:00:00.000Z", "cancelled"),
        appointment("no-show", "2026-08-17T16:00:00.000Z", "no_show"),
        appointment("invalid", "not-a-date"),
      ],
      afternoonInChico,
    );

    expect(result).toBeNull();
  });

  it("uses Pacific midnight as the direct Jobber fallback boundary", () => {
    expect(portalAppointmentLowerBoundIso(afternoonInChico)).toBe(
      "2026-08-14T07:00:00.000Z",
    );
  });
});
