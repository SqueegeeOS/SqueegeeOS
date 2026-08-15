import { describe, expect, it } from "vitest";
import {
  classifyJobberTodayVisit,
  isJobberTodayDataStale,
  readJobberTodayVisitAssignment,
  readJobberTodayVisitScope,
  resolveJobberTodayHomeAtlasContext,
  summarizeJobberTodayVisits,
} from "./jobber-today-types";

const scheduledVisit = {
  isComplete: false,
  scheduledStart: "2026-08-01T16:00:00.000Z",
  scheduledEnd: "2026-08-01T18:00:00.000Z",
};

describe("Jobber Today board states", () => {
  it("uses completion as the authoritative terminal state", () => {
    expect(
      classifyJobberTodayVisit(
        { ...scheduledVisit, isComplete: true },
        new Date("2026-08-01T15:00:00.000Z"),
      ),
    ).toBe("complete");
  });

  it("distinguishes upcoming, active, and late scheduled visits", () => {
    expect(
      classifyJobberTodayVisit(
        scheduledVisit,
        new Date("2026-08-01T15:00:00.000Z"),
      ),
    ).toBe("upcoming");
    expect(
      classifyJobberTodayVisit(
        scheduledVisit,
        new Date("2026-08-01T17:00:00.000Z"),
      ),
    ).toBe("in_progress");
    expect(
      classifyJobberTodayVisit(
        scheduledVisit,
        new Date("2026-08-01T19:00:00.000Z"),
      ),
    ).toBe("late");
  });

  it("flags missing, invalid, and older synchronization snapshots", () => {
    const now = new Date("2026-08-01T20:00:00.000Z");
    expect(isJobberTodayDataStale(null, now)).toBe(true);
    expect(isJobberTodayDataStale("not-a-date", now)).toBe(true);
    expect(
      isJobberTodayDataStale("2026-08-01T15:00:00.000Z", now),
    ).toBe(false);
    expect(
      isJobberTodayDataStale("2026-08-01T13:59:59.000Z", now),
    ).toBe(true);
  });

  it("reads normalized and provider-shaped crew assignments defensively", () => {
    expect(
      readJobberTodayVisitAssignment({
        assignmentReadState: "available",
        assignedUsers: [
          { id: "user-1", name: "Alex Rivera" },
          { id: "user-1", name: "Alex Rivera" },
        ],
      }),
    ).toEqual({
      assignedUsers: [{ id: "user-1", name: "Alex Rivera" }],
      assignmentReadState: "available",
    });
    expect(
      readJobberTodayVisitAssignment({
        assignedUsers: {
          nodes: [{ id: "user-2", name: { full: "Sam Lee" } }],
        },
      }),
    ).toEqual({
      assignedUsers: [{ id: "user-2", name: "Sam Lee" }],
      assignmentReadState: "available",
    });
    expect(readJobberTodayVisitAssignment({})).toEqual({
      assignedUsers: [],
      assignmentReadState: "not_observed",
    });
    expect(
      readJobberTodayVisitAssignment({
        assignmentReadState: "permission_hidden",
        assignedUsers: [{ id: "do-not-trust", name: "Hidden" }],
      }),
    ).toEqual({
      assignedUsers: [],
      assignmentReadState: "permission_hidden",
    });
  });

  it("reads authoritative Jobber service scope without inventing missing work", () => {
    expect(
      readJobberTodayVisitScope({
        scopeReadState: "available",
        scopeItems: [
          {
            id: "line-1",
            name: "Exterior window cleaning",
            description: "Glass and frames",
            quantity: 1,
            category: "SERVICE",
          },
          {
            id: "line-1",
            name: "Exterior window cleaning",
            description: "Glass and frames",
            quantity: 1,
            category: "SERVICE",
          },
        ],
      }),
    ).toEqual({
      scopeItems: [
        {
          id: "line-1",
          name: "Exterior window cleaning",
          description: "Glass and frames",
          quantity: 1,
          category: "SERVICE",
        },
      ],
      scopeReadState: "available",
    });
    expect(
      readJobberTodayVisitScope({
        scopeReadState: "partial",
        lineItems: {
          nodes: [
            {
              id: "line-2",
              name: "Screens",
              description: null,
              quantity: 12,
              category: "SERVICE",
            },
          ],
        },
      }),
    ).toEqual({
      scopeItems: [
        {
          id: "line-2",
          name: "Screens",
          description: null,
          quantity: 12,
          category: "SERVICE",
        },
      ],
      scopeReadState: "partial",
    });
    expect(
      readJobberTodayVisitScope({
        scopeReadState: "permission_hidden",
        scopeItems: [{ id: "do-not-trust", name: "Hidden" }],
      }),
    ).toEqual({ scopeItems: [], scopeReadState: "permission_hidden" });
    expect(readJobberTodayVisitScope({})).toEqual({
      scopeItems: [],
      scopeReadState: "not_observed",
    });
  });

  it("separates Jobber completion from proven HomeAtlas closeout", () => {
    expect(
      summarizeJobberTodayVisits([
        {
          isComplete: true,
          homeAtlasFieldRecordCount: 1,
          homeAtlasCustomerVisibleRecordCount: 1,
          homeAtlasFieldStage: "departed",
          assignedUsers: [{ id: "user-1", name: "Alex" }],
          assignmentReadState: "available",
        },
        {
          isComplete: true,
          homeAtlasFieldRecordCount: 1,
          homeAtlasCustomerVisibleRecordCount: 0,
          homeAtlasFieldStage: "departed",
          assignedUsers: [],
          assignmentReadState: "available",
        },
        {
          isComplete: true,
          homeAtlasFieldRecordCount: 0,
          homeAtlasCustomerVisibleRecordCount: 0,
          homeAtlasFieldStage: "service_completed",
          assignedUsers: [],
          assignmentReadState: "permission_hidden",
        },
        {
          isComplete: false,
          homeAtlasFieldRecordCount: 0,
          homeAtlasCustomerVisibleRecordCount: 0,
          homeAtlasFieldStage: "departed",
          assignedUsers: [],
          assignmentReadState: "not_observed",
        },
      ]),
    ).toEqual({
      total: 4,
      complete: 3,
      remaining: 1,
      documented: 2,
      portalUpdated: 1,
      completedWithoutRecord: 1,
      completedWithPrivateOnlyRecord: 1,
      jobberCompletionPending: 1,
      assigned: 1,
      unassigned: 1,
      assignmentUnknown: 2,
    });
  });

  it("opens field capture only through the active property and appointment pair", () => {
    expect(
      resolveJobberTodayHomeAtlasContext({
        externalPropertyId: "jobber-property-1",
        externalVisitId: "visit-1",
        propertyLinks: [
          {
            externalPropertyId: "jobber-property-1",
            propertyId: "homeatlas-property-1",
            membershipId: "membership-1",
          },
        ],
        appointmentLinks: [
          {
            externalVisitId: "visit-1",
            propertyId: "homeatlas-property-1",
            appointmentId: "appointment-1",
          },
          {
            externalVisitId: "visit-1",
            propertyId: "wrong-property",
            appointmentId: "wrong-appointment",
          },
        ],
      }),
    ).toEqual({
      homeAtlasPropertyId: "homeatlas-property-1",
      homeAtlasAppointmentId: "appointment-1",
      homeAtlasMembershipId: "membership-1",
    });
  });

  it("fails closed when the Jobber property is not paired", () => {
    expect(
      resolveJobberTodayHomeAtlasContext({
        externalPropertyId: "unpaired-property",
        externalVisitId: "visit-1",
        propertyLinks: [],
        appointmentLinks: [],
      }),
    ).toEqual({
      homeAtlasPropertyId: null,
      homeAtlasAppointmentId: null,
      homeAtlasMembershipId: null,
    });
  });
});
