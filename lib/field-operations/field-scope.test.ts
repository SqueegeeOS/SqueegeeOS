import { describe, expect, it } from "vitest";
import type {
  JobberTodayData,
  JobberTodayVisit,
} from "@/lib/care-operations/jobber-today-types";
import {
  isFieldWriteTimeAllowed,
  isVisitAssignedToTechnician,
  scopeTodayBoardToTechnician,
} from "./field-scope";

function visit(
  id: string,
  assignmentReadState: JobberTodayVisit["assignmentReadState"],
  assignedUsers: JobberTodayVisit["assignedUsers"],
  appointmentId = `appointment-${id}`,
): JobberTodayVisit {
  return {
    projectionId: id,
    externalVisitId: `external-${id}`,
    clientName: `Customer ${id}`,
    title: "Window cleaning",
    jobNumber: 1,
    visitStatus: "scheduled",
    jobStatus: "active",
    scheduledStart: "2026-08-14T16:00:00.000Z",
    scheduledEnd: "2026-08-14T17:00:00.000Z",
    isComplete: false,
    assignedUsers,
    assignmentReadState,
    scopeItems: [],
    scopeReadState: "available",
    propertyLabel: "1 Main St",
    jobberPropertyWebUri: null,
    jobberClientWebUri: null,
    homeAtlasPropertyId: `property-${id}`,
    homeAtlasAppointmentId: appointmentId,
    homeAtlasMembershipId: `membership-${id}`,
    homeAtlasPortalPath: null,
    homeAtlasFieldRecordCount: 0,
    homeAtlasLatestFieldRecordAt: null,
    homeAtlasLatestFieldRecordBy: null,
    homeAtlasCustomerVisibleRecordCount: 0,
    homeAtlasOpenFollowUpCount: 0,
    homeAtlasFieldStage: "not_started",
    homeAtlasFieldStageAt: null,
    homeAtlasFieldStageBy: null,
    homeAtlasFieldEventCount: 0,
  };
}

describe("technician field scope", () => {
  it("fails closed unless Jobber assignment visibility is exact", () => {
    const assigned = visit("assigned", "available", [
      { id: "jobber-alex", name: "Alex" },
    ]);
    expect(isVisitAssignedToTechnician(assigned, "jobber-alex")).toBe(true);
    expect(isVisitAssignedToTechnician(assigned, "jobber-sam")).toBe(false);
    expect(
      isVisitAssignedToTechnician(
        visit("hidden", "permission_hidden", [
          { id: "jobber-alex", name: "Alex" },
        ]),
        "jobber-alex",
      ),
    ).toBe(false);
  });

  it("returns only assigned visits without portal bearer paths or HQ notes", () => {
    const alex = visit("alex", "available", [
      { id: "jobber-alex", name: "Alex" },
    ]);
    const sam = visit("sam", "available", [
      { id: "jobber-sam", name: "Sam" },
    ]);
    const board = {
      calendarDate: "2026-08-14",
      timezone: "America/Los_Angeles",
      connected: true,
      connectionStatus: "connected",
      accountName: "SqueegeeKing",
      lastSyncedAt: "2026-08-14T15:00:00.000Z",
      loadedAt: "2026-08-14T15:01:00.000Z",
      fieldRecordStatusAvailable: true,
      fieldEventStatusAvailable: true,
      summary: {
        total: 2,
        complete: 0,
        remaining: 2,
        documented: 0,
        portalUpdated: 0,
        completedWithoutRecord: 0,
        completedWithPrivateOnlyRecord: 0,
        assigned: 2,
        unassigned: 0,
        assignmentUnknown: 0,
      },
      visits: [alex, sam],
      fieldFollowUps: [
        {
          assessmentId: "assessment-alex",
          fieldRecordId: null,
          propertyId: "property-alex",
          appointmentId: "appointment-alex",
          homeownerName: "Alex Customer",
          propertyName: "Alex Home",
          propertyAddress: "1 Main",
          technicianName: "Alex",
          visitDate: "2026-08-14",
          customerSummary: null,
          internalNote: "Gate",
          dueAt: "2026-08-15T16:00:00.000Z",
          createdAt: "2026-08-14T17:00:00.000Z",
        },
        {
          assessmentId: "assessment-sam",
          fieldRecordId: null,
          propertyId: "property-sam",
          appointmentId: "appointment-sam",
          homeownerName: "Sam Customer",
          propertyName: "Sam Home",
          propertyAddress: "2 Main",
          technicianName: "Sam",
          visitDate: "2026-08-14",
          customerSummary: null,
          internalNote: "Gate",
          dueAt: "2026-08-15T16:00:00.000Z",
          createdAt: "2026-08-14T17:00:00.000Z",
        },
      ],
    } satisfies JobberTodayData;

    const scoped = scopeTodayBoardToTechnician(board, "jobber-alex");
    expect(scoped.visits.map((candidate) => candidate.projectionId)).toEqual([
      "alex",
    ]);
    expect(scoped.fieldFollowUps).toEqual([]);
    expect(scoped.visits[0]?.jobberClientWebUri).toBeNull();
    expect(scoped.visits[0]?.homeAtlasMembershipId).toBeNull();
    expect(scoped.visits[0]?.homeAtlasPortalPath).toBeNull();
    expect(scoped.summary.total).toBe(1);
    expect(scoped.summary.assigned).toBe(1);
  });

  it("allows closeout near the scheduled stop but not indefinite historical writes", () => {
    const now = new Date("2026-08-14T18:00:00.000Z");
    expect(isFieldWriteTimeAllowed("2026-08-14T16:00:00.000Z", now)).toBe(
      true,
    );
    expect(isFieldWriteTimeAllowed("2026-08-01T16:00:00.000Z", now)).toBe(
      false,
    );
    expect(isFieldWriteTimeAllowed("2026-08-20T16:00:00.000Z", now)).toBe(
      false,
    );
    expect(isFieldWriteTimeAllowed(null, now)).toBe(false);
  });
});
