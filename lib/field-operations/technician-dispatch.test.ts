import { describe, expect, it } from "vitest";
import type {
  JobberTodayData,
  JobberTodayVisit,
} from "@/lib/care-operations/jobber-today-types";
import type {
  TechnicianAccessGrantView,
  TechnicianRosterMember,
} from "./field-access";
import {
  buildTechnicianDispatchBoard,
  resolveTechnicianFieldPassState,
} from "./technician-dispatch";

const NOW = new Date("2026-08-14T18:00:00.000Z");

function grant(
  overrides: Partial<TechnicianAccessGrantView> = {},
): TechnicianAccessGrantView {
  return {
    id: "grant-alex",
    jobberUserId: "user-alex",
    displayName: "Alex",
    status: "active",
    inviteExpiresAt: "2026-08-15T18:00:00.000Z",
    sessionExpiresAt: "2026-09-14T18:00:00.000Z",
    claimedAt: "2026-08-14T10:00:00.000Z",
    revokedAt: null,
    createdAt: "2026-08-14T09:00:00.000Z",
    ...overrides,
  };
}

function rosterMember(
  jobberUserId: string,
  displayName: string,
  currentGrant: TechnicianAccessGrantView | null,
): TechnicianRosterMember {
  return {
    jobberUserId,
    displayName,
    observedStopCount: 2,
    latestObservedAt: "2026-08-14T17:00:00.000Z",
    currentGrant,
  };
}

function visit(
  id: string,
  userId: string | null,
  overrides: Partial<JobberTodayVisit> = {},
): JobberTodayVisit {
  return {
    projectionId: id,
    externalVisitId: `external-${id}`,
    clientName: `${id} Customer`,
    title: "Exterior window cleaning",
    jobNumber: 100,
    visitStatus: "SCHEDULED",
    jobStatus: "ACTIVE",
    scheduledStart: "2026-08-14T17:00:00.000Z",
    scheduledEnd: "2026-08-14T19:00:00.000Z",
    isComplete: false,
    assignedUsers: userId ? [{ id: userId, name: userId }] : [],
    assignmentReadState: "available",
    scopeItems: [],
    scopeReadState: "available",
    propertyLabel: "Customer Home",
    jobberPropertyWebUri: "https://secure.getjobber.com/properties/1",
    jobberClientWebUri: "https://secure.getjobber.com/clients/1",
    homeAtlasPropertyId: "property-1",
    homeAtlasAppointmentId: `appointment-${id}`,
    homeAtlasMembershipId: "membership-1",
    homeAtlasPortalPath: "/portal/private-bearer-token",
    homeAtlasFieldAssignmentId: null,
    homeAtlasAssignedTechnicianId: null,
    homeAtlasAssignedTechnicianName: null,
    homeAtlasFieldRecordCount: 0,
    homeAtlasLatestFieldRecordAt: null,
    homeAtlasLatestFieldRecordBy: null,
    homeAtlasCustomerVisibleRecordCount: 0,
    homeAtlasOpenFollowUpCount: 0,
    homeAtlasFieldCustomerSummary: null,
    homeAtlasFieldInternalNote: null,
    homeAtlasFieldScopeException: null,
    homeAtlasFieldPhotoCount: 0,
    homeAtlasFieldStage: "not_started",
    homeAtlasFieldStageAt: null,
    homeAtlasFieldStageBy: null,
    homeAtlasFieldEventCount: 0,
    homeAtlasJobClock: {
      state: "not_started",
      startedAt: null,
      endedAt: null,
      durationSeconds: null,
      startedByDisplayName: null,
      finishedByDisplayName: null,
    },
    homeAtlasIndependenceReview: null,
    ...overrides,
  };
}

function today(visits: JobberTodayVisit[]): JobberTodayData {
  const assigned = visits.filter(
    (candidate) =>
      candidate.assignmentReadState === "available" &&
      candidate.assignedUsers.length > 0,
  ).length;
  const unassigned = visits.filter(
    (candidate) =>
      candidate.assignmentReadState === "available" &&
      candidate.assignedUsers.length === 0,
  ).length;
  const assignmentUnknown = visits.filter(
    (candidate) => candidate.assignmentReadState !== "available",
  ).length;
  return {
    calendarDate: "2026-08-14",
    timezone: "America/Los_Angeles",
    connected: true,
    connectionStatus: "connected",
    accountName: "SqueegeeKing",
    lastSyncedAt: "2026-08-14T17:55:00.000Z",
    loadedAt: NOW.toISOString(),
    fieldRecordStatusAvailable: true,
    fieldEventStatusAvailable: true,
    jobClockStatusAvailable: true,
    independenceReviewStatusAvailable: true,
    summary: {
      total: visits.length,
      complete: visits.filter((candidate) => candidate.isComplete).length,
      remaining: visits.filter((candidate) => !candidate.isComplete).length,
      documented: visits.filter(
        (candidate) => candidate.homeAtlasFieldRecordCount > 0,
      ).length,
      portalUpdated: visits.filter(
        (candidate) => candidate.homeAtlasCustomerVisibleRecordCount > 0,
      ).length,
      completedWithoutRecord: 0,
      completedWithPrivateOnlyRecord: 0,
      jobberCompletionPending: visits.filter(
        (candidate) =>
          !candidate.isComplete &&
          candidate.homeAtlasFieldStage === "departed",
      ).length,
      assigned,
      unassigned,
      assignmentUnknown,
    },
    visits,
    fieldFollowUps: [],
  };
}

describe("technician dispatch", () => {
  it("classifies active, expiring, pending, expired, revoked, and missing passes", () => {
    expect(resolveTechnicianFieldPassState(grant(), NOW)).toBe("active");
    expect(
      resolveTechnicianFieldPassState(
        grant({ sessionExpiresAt: "2026-08-16T18:00:00.000Z" }),
        NOW,
      ),
    ).toBe("expiring");
    expect(
      resolveTechnicianFieldPassState(
        grant({ status: "pending", sessionExpiresAt: null }),
        NOW,
      ),
    ).toBe("pending");
    expect(
      resolveTechnicianFieldPassState(
        grant({ sessionExpiresAt: "2026-08-14T17:00:00.000Z" }),
        NOW,
      ),
    ).toBe("expired");
    expect(
      resolveTechnicianFieldPassState(grant({ status: "revoked" }), NOW),
    ).toBe("revoked");
    expect(resolveTechnicianFieldPassState(null, NOW)).toBe("missing");
  });

  it("shows exact live work, missing access, and source-system exceptions", () => {
    const alexVisit = visit("alex-stop", "user-alex", {
      assignedUsers: [{ id: "user-alex", name: "Alex" }],
      homeAtlasFieldStage: "service_started",
      homeAtlasFieldStageAt: "2026-08-14T17:45:00.000Z",
      homeAtlasFieldEventCount: 3,
    });
    const samVisit = visit("sam-stop", "user-sam", {
      assignedUsers: [{ id: "user-sam", name: "Sam" }],
    });
    const doneButOpen = visit("alex-done", "user-alex", {
      assignedUsers: [{ id: "user-alex", name: "Alex" }],
      homeAtlasFieldStage: "departed",
      homeAtlasFieldStageAt: "2026-08-14T16:00:00.000Z",
      homeAtlasFieldRecordCount: 1,
      homeAtlasCustomerVisibleRecordCount: 1,
    });
    const unassigned = visit("unassigned", null);
    const board = buildTechnicianDispatchBoard({
      roster: [
        rosterMember("user-alex", "Alex", grant()),
        rosterMember("user-sam", "Sam", null),
      ],
      today: today([alexVisit, samVisit, doneButOpen, unassigned]),
      referenceDate: NOW,
    });

    expect(board.summary).toMatchObject({
      scheduledStops: 4,
      scheduledCrew: 2,
      activeCrew: 1,
      attentionCrew: 2,
      crewWithoutUsablePass: 1,
      unassignedStops: 1,
    });
    const alex = board.crew.find((member) => member.jobberUserId === "user-alex");
    const sam = board.crew.find((member) => member.jobberUserId === "user-sam");
    expect(alex).toMatchObject({
      dispatchState: "attention",
      fieldPassState: "active",
      assignedStopCount: 2,
      actionRequiredStopCount: 1,
      attentionStop: {
        projectionId: "alex-done",
        readiness: "jobber_completion_pending",
      },
      activeStop: {
        projectionId: "alex-stop",
        fieldStage: "service_started",
      },
    });
    expect(alex?.attentionStop?.todayHref).toBe(
      "/hq/today#visit-alex-done",
    );
    expect(sam).toMatchObject({
      dispatchState: "attention",
      fieldPassState: "missing",
      assignedStopCount: 1,
    });
  });

  it("includes today's newly observed assigned user and strips private route fields", () => {
    const board = buildTechnicianDispatchBoard({
      roster: [],
      today: today([
        visit("new-stop", "new-user", {
          assignedUsers: [{ id: "new-user", name: "Taylor" }],
        }),
      ]),
      referenceDate: NOW,
    });

    expect(board.crew).toHaveLength(1);
    expect(board.crew[0]).toMatchObject({
      jobberUserId: "new-user",
      displayName: "Taylor",
      fieldPassState: "missing",
      assignedStopCount: 1,
    });
    const serialized = JSON.stringify(board);
    expect(serialized).not.toContain("private-bearer-token");
    expect(serialized).not.toContain("secure.getjobber.com/clients");
    expect(serialized).not.toContain("homeAtlasMembershipId");
    expect(serialized).not.toContain("jobberClientWebUri");
  });

  it("marks a fully documented route done without manufacturing attention", () => {
    const complete = visit("complete", "user-alex", {
      assignedUsers: [{ id: "user-alex", name: "Alex" }],
      isComplete: true,
      homeAtlasFieldRecordCount: 1,
      homeAtlasCustomerVisibleRecordCount: 1,
      homeAtlasFieldStage: "departed",
      homeAtlasFieldStageAt: "2026-08-14T17:50:00.000Z",
    });
    const board = buildTechnicianDispatchBoard({
      roster: [rosterMember("user-alex", "Alex", grant())],
      today: today([complete]),
      referenceDate: NOW,
    });

    expect(board.crew[0]).toMatchObject({
      dispatchState: "done",
      actionRequiredStopCount: 0,
      activeStop: null,
      nextStop: null,
    });
    expect(board.summary).toMatchObject({
      doneCrew: 1,
      attentionCrew: 0,
    });
  });

  it("keeps an off-route expired pass quiet until that technician is scheduled", () => {
    const board = buildTechnicianDispatchBoard({
      roster: [
        rosterMember(
          "user-alex",
          "Alex",
          grant({ sessionExpiresAt: "2026-08-13T18:00:00.000Z" }),
        ),
      ],
      today: today([]),
      referenceDate: NOW,
    });

    expect(board.crew[0]).toMatchObject({
      dispatchState: "off_route",
      fieldPassState: "expired",
      assignedStopCount: 0,
    });
    expect(board.summary.attentionCrew).toBe(0);
  });
});
