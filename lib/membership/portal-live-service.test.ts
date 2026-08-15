import { describe, expect, it } from "vitest";
import type { TechnicianVisitEventSnapshot } from "@/lib/field-operations/technician-visit-events";
import type { MemberAppointmentSummary } from "@/lib/member-intelligence/types";
import {
  buildPortalLiveServiceStatus,
  portalLiveServiceAppointmentIds,
} from "./portal-live-service";

const REFERENCE = new Date("2026-08-14T19:00:00.000Z");

function appointment(
  overrides: Partial<MemberAppointmentSummary> = {},
): MemberAppointmentSummary {
  return {
    id: "appointment-today",
    date: "2026-08-14T17:00:00.000Z",
    serviceType: "exterior_windows",
    technician: "Private Technician Name",
    notes: "Private appointment note",
    status: "scheduled",
    ...overrides,
  };
}

function snapshot(
  overrides: Partial<TechnicianVisitEventSnapshot> = {},
): TechnicianVisitEventSnapshot {
  return {
    stage: "service_started",
    occurredAt: "2026-08-14T18:30:00.000Z",
    actorDisplayName: "Private Technician Name",
    eventCount: 3,
    ...overrides,
  };
}

describe("portal live service projection", () => {
  it("selects only appointments on today's company calendar day", () => {
    expect(
      portalLiveServiceAppointmentIds(
        [
          appointment(),
          appointment({
            id: "tomorrow",
            date: "2026-08-15T17:00:00.000Z",
          }),
          appointment({ id: "cancelled", status: "cancelled" }),
        ],
        REFERENCE,
      ),
    ).toEqual(["appointment-today"]);
  });

  it("creates a small customer-safe live status without internal identity", () => {
    const internal = snapshot() as TechnicianVisitEventSnapshot & {
      technicianAccessGrantId: string;
      externalVisitId: string;
      customerAlertDraft: string;
    };
    internal.technicianAccessGrantId = "private-grant";
    internal.externalVisitId = "private-jobber-visit";
    internal.customerAlertDraft = "private unsent SMS copy";

    const result = buildPortalLiveServiceStatus({
      appointments: [appointment()],
      snapshotsByAppointmentId: new Map([["appointment-today", internal]]),
      referenceDate: REFERENCE,
    });

    expect(result).toEqual({
      stage: "service_started",
      statusLabel: "Service in progress",
      headline: "Your home service is in progress.",
      support: "Your team is caring for your property now.",
      serviceTypeLabel: "Exterior Window Cleaning",
      scheduledAt: "2026-08-14T17:00:00.000Z",
      updatedAt: "2026-08-14T18:30:00.000Z",
      progress: { completed: 3, total: 5 },
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("Private Technician Name");
    expect(serialized).not.toContain("private-grant");
    expect(serialized).not.toContain("private-jobber-visit");
    expect(serialized).not.toContain("private unsent SMS copy");
    expect(serialized).not.toContain("Private appointment note");
  });

  it("hides not-started, stale, future, and cancelled route state", () => {
    const cases = [
      {
        appointment: appointment(),
        snapshot: snapshot({
          stage: "not_started",
          occurredAt: null,
          eventCount: 0,
        }),
      },
      {
        appointment: appointment(),
        snapshot: snapshot({ occurredAt: "2026-08-13T18:30:00.000Z" }),
      },
      {
        appointment: appointment({ date: "2026-08-15T17:00:00.000Z" }),
        snapshot: snapshot(),
      },
      {
        appointment: appointment({ status: "cancelled" }),
        snapshot: snapshot(),
      },
    ];

    for (const testCase of cases) {
      expect(
        buildPortalLiveServiceStatus({
          appointments: [testCase.appointment],
          snapshotsByAppointmentId: new Map([
            [testCase.appointment.id, testCase.snapshot],
          ]),
          referenceDate: REFERENCE,
        }),
      ).toBeNull();
    }
  });

  it.each([
    ["en_route", 1, "On the way"],
    ["arrived", 2, "Arrived"],
    ["service_started", 3, "Service in progress"],
    ["service_completed", 4, "Service complete"],
    ["departed", 5, "Visit complete"],
  ] as const)("maps %s to customer progress", (stage, completed, label) => {
    const result = buildPortalLiveServiceStatus({
      appointments: [appointment()],
      snapshotsByAppointmentId: new Map([
        ["appointment-today", snapshot({ stage })],
      ]),
      referenceDate: REFERENCE,
    });

    expect(result?.statusLabel).toBe(label);
    expect(result?.progress).toEqual({ completed, total: 5 });
  });
});
