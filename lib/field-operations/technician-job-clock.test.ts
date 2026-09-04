import { describe, expect, it } from "vitest";
import {
  canCreateNativeJobCloseout,
  technicianCanDocumentVisit,
  technicianCanFinishJob,
  technicianJobClockElapsedSeconds,
  technicianJobClockState,
  validateTechnicianJobClockRequest,
} from "./technician-job-clock";

const VALID_REQUEST = {
  actionId: "1c70e44a-4fcb-4ffd-94fa-820c12d58e4b",
  propertyId: "758b1b60-ebbb-4831-8103-3493b0e99410",
  appointmentId: "c8cd94e2-533d-49e7-afc5-c90d06bf5056",
  action: "start" as const,
};

describe("technician job clock", () => {
  it("offers native closeout only while running and before the first saved record", () => {
    expect(canCreateNativeJobCloseout("not_started", 0)).toBe(false);
    expect(canCreateNativeJobCloseout("running", 0)).toBe(true);
    expect(canCreateNativeJobCloseout("running", 1)).toBe(false);
    expect(canCreateNativeJobCloseout("finished", 0)).toBe(false);
    expect(canCreateNativeJobCloseout("finished", 1)).toBe(false);
    expect(canCreateNativeJobCloseout("running", Number.NaN)).toBe(false);
  });
  it("accepts only appointment-scoped start and finish actions", () => {
    expect(validateTechnicianJobClockRequest(VALID_REQUEST)).toBeNull();
    expect(
      validateTechnicianJobClockRequest({
        ...VALID_REQUEST,
        action: "pause",
      }),
    ).toContain("start or finish");
    expect(
      validateTechnicianJobClockRequest({
        ...VALID_REQUEST,
        appointmentId: "not-an-appointment",
      }),
    ).toContain("valid HomeAtlas appointment");
  });

  it("derives the simple two-tap state", () => {
    expect(
      technicianJobClockState({ startedAt: null, endedAt: null }),
    ).toBe("not_started");
    expect(
      technicianJobClockState({
        startedAt: "2026-08-31T16:00:00.000Z",
        endedAt: null,
      }),
    ).toBe("running");
    expect(
      technicianJobClockState({
        startedAt: "2026-08-31T16:00:00.000Z",
        endedAt: "2026-08-31T18:15:30.000Z",
      }),
    ).toBe("finished");
  });

  it("calculates actual elapsed on-site seconds without going negative", () => {
    expect(
      technicianJobClockElapsedSeconds(
        {
          startedAt: "2026-08-31T16:00:00.000Z",
          endedAt: "2026-08-31T18:15:30.000Z",
        },
        new Date("2026-08-31T20:00:00.000Z"),
      ),
    ).toBe(8_130);
    expect(
      technicianJobClockElapsedSeconds(
        {
          startedAt: "2026-08-31T18:00:00.000Z",
          endedAt: null,
        },
        new Date("2026-08-31T17:59:00.000Z"),
      ),
    ).toBe(0);
  });

  it("accepts one native field assignment target and rejects ambiguous targets", () => {
    const fieldAssignmentId = "99999999-9999-4999-8999-999999999999";
    expect(
      validateTechnicianJobClockRequest({
        actionId: VALID_REQUEST.actionId,
        fieldAssignmentId,
        action: "start",
      }),
    ).toBeNull();
    expect(
      validateTechnicianJobClockRequest({
        ...VALID_REQUEST,
        fieldAssignmentId,
      }),
    ).toContain("one valid HomeAtlas job target");
  });

  it("requires an arrival clock before proof and a closeout before clock-out", () => {
    expect(technicianCanDocumentVisit("not_started")).toBe(false);
    expect(technicianCanDocumentVisit("running")).toBe(true);
    expect(technicianCanDocumentVisit("finished")).toBe(true);

    expect(
      technicianCanFinishJob({ state: "running", hasFieldRecord: false }),
    ).toBe(false);
    expect(
      technicianCanFinishJob({ state: "running", hasFieldRecord: true }),
    ).toBe(true);
    expect(
      technicianCanFinishJob({ state: "not_started", hasFieldRecord: true }),
    ).toBe(false);
  });
});
