import { describe, expect, it } from "vitest";
import { toTodayVisit } from "./jobber-today";
import { EMPTY_TECHNICIAN_JOB_CLOCK } from "../field-operations/technician-job-clock";
import type { HomeAtlasFieldExecutionSnapshot } from "../field-operations/homeatlas-field-assignment";

const execution: HomeAtlasFieldExecutionSnapshot = {
  clock: { ...EMPTY_TECHNICIAN_JOB_CLOCK, state: "running", startedAt: "2026-09-04T18:00:00Z", startedByDisplayName: "Tyler Germany" },
  fieldRecordCount: 1, latestFieldRecordAt: "2026-09-04T19:00:00Z", latestFieldRecordBy: "Tyler Germany",
  customerVisibleRecordCount: 0, openFollowUpCount: 1, customerSummary: "Glass cleaned.", internalNote: "Gate loose.", scopeException: null, photoCount: 2,
};
function mapped(native: HomeAtlasFieldExecutionSnapshot | undefined, hasAssignment = true) {
  return toTodayVisit({ id: "projection", external_visit_id: "visit", external_client_id: "client", external_property_id: "external-property",
    jobber_property_web_uri: null, job_number: 10, title: "Windows", client_name: "Test Household", visit_status: "SCHEDULED", job_status: null,
    scheduled_start: "2026-09-04T18:00:00Z", scheduled_end: null, is_complete: false, raw_payload: {},
  }, undefined,
  [{ externalPropertyId: "external-property", propertyId: "property", membershipId: "member" }],
  [{ externalVisitId: "visit", propertyId: "property", appointmentId: "appointment" }],
  new Map([["appointment", { count: 0, latestFieldRecordAt: "2026-08-01T00:00:00Z", latestTechnicianName: "Legacy tech", customerVisibleCount: 0, openFollowUpCount: 0 }]]),
  new Map([["appointment", { stage: "arrived", occurredAt: "2026-08-01T00:00:00Z", actorDisplayName: "Legacy tech", eventCount: 1 }]]),
  new Map([["appointment", { ...EMPTY_TECHNICIAN_JOB_CLOCK, state: "finished", startedAt: "2026-08-01T00:00:00Z", endedAt: "2026-08-01T01:00:00Z" }]]),
  new Map(), new Map(),
  hasAssignment ? new Map([["visit", { id: "assignment", projectionId: "projection", externalVisitId: "visit", technicianId: "tech", technicianIdentityKey: "homeatlas:tech", technicianDisplayName: "Tyler Germany", assignedAt: "2026-09-03T00:00:00Z" }]]) : new Map(),
  native ? new Map([["assignment", native]]) : new Map());
}

describe("member-linked native field truth", () => {
  it("does not let legacy empty records or clocks hide the current assigned technician's work", () => {
    expect(mapped(execution)).toMatchObject({ homeAtlasFieldRecordCount: 1, homeAtlasLatestFieldRecordBy: "Tyler Germany",
      homeAtlasFieldStage: "service_completed", homeAtlasOpenFollowUpCount: 1, homeAtlasCustomerVisibleRecordCount: 0,
      homeAtlasJobClock: { state: "running" }, isComplete: false });
  });
  it("uses actual clock-out time and never changes Jobber completion", () => {
    expect(mapped({ ...execution, clock: { ...execution.clock, state: "finished", endedAt: "2026-09-04T19:15:00Z", finishedByDisplayName: "Tyler Germany" } }))
      .toMatchObject({ homeAtlasFieldStage: "departed", homeAtlasFieldStageAt: "2026-09-04T19:15:00Z", isComplete: false });
  });
  it("fails closed when native execution could not load instead of borrowing a legacy finished clock", () => {
    expect(mapped(undefined)).toMatchObject({ homeAtlasFieldRecordCount: 0, homeAtlasFieldStage: "not_started", homeAtlasJobClock: { state: "not_started" } });
  });
  it("preserves legacy execution when the visit has no native assignment", () => {
    expect(mapped(undefined, false)).toMatchObject({ homeAtlasFieldStage: "arrived", homeAtlasJobClock: { state: "finished" } });
  });
});
