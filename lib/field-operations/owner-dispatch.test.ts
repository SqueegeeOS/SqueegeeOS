import { describe, expect, it } from "vitest";
import {
  buildOwnerDispatchPayload,
  normalizeOwnerDispatchMonth,
  ownerDispatchMonthUtcBounds,
  type OwnerDispatchProjectionRow,
} from "./owner-dispatch";

function projection(
  overrides: Partial<OwnerDispatchProjectionRow> = {},
): OwnerDispatchProjectionRow {
  return {
    id: "visit-projection-1",
    external_visit_id: "visit-1",
    external_property_id: "property-1",
    jobber_property_web_uri: "https://secure.getjobber.com/properties/1",
    property_name: "Home",
    property_address: {
      street1: "123 Main St",
      city: "Chico",
      province: "CA",
      postalCode: "95928",
    },
    job_number: 101,
    title: "Window cleaning",
    client_name: "Taylor Homeowner",
    visit_status: "ACTIVE",
    job_status: "ACTIVE",
    scheduled_start: "2026-08-10T16:00:00.000Z",
    scheduled_end: "2026-08-10T18:00:00.000Z",
    is_complete: false,
    raw_payload: {
      assignedUsers: [{ id: "tech-1", name: "Alex Tech" }],
      assignmentReadState: "available",
      scopeItems: [
        { id: "scope-1", name: "Exterior windows", quantity: 1 },
      ],
    },
    ...overrides,
  };
}

describe("owner dispatch month", () => {
  it("normalizes invalid input to the Pacific business month", () => {
    expect(
      normalizeOwnerDispatchMonth("banana", new Date("2026-09-01T03:00:00Z")),
    ).toBe("2026-08");
  });

  it("uses DST-aware exclusive UTC boundaries", () => {
    const bounds = ownerDispatchMonthUtcBounds("2026-11");
    expect(bounds.startUtc.toISOString()).toBe("2026-11-01T07:00:00.000Z");
    expect(bounds.endUtc.toISOString()).toBe("2026-12-01T08:00:00.000Z");
  });
});

describe("buildOwnerDispatchPayload", () => {
  it("summarizes verified assignments, workload, and map coverage", () => {
    const payload = buildOwnerDispatchPayload({
      month: "2026-08",
      connected: true,
      connectionStatus: "connected",
      accountName: "Squeegee King",
      lastSyncedAt: "2026-08-10T12:00:00.000Z",
      generatedAt: "2026-08-10T12:01:00.000Z",
      projections: [
        projection(),
        projection({
          id: "visit-projection-2",
          external_visit_id: "visit-2",
          external_property_id: "property-2",
          raw_payload: {
            assignedUsers: [],
            assignmentReadState: "available",
          },
        }),
      ],
      geocodes: [
        {
          external_property_id: "property-1",
          formatted_address: "123 Main St, Chico, CA 95928",
          latitude: 39.72,
          longitude: -121.83,
          geocode_status: "resolved",
        },
      ],
    });

    expect(payload.summary).toMatchObject({
      total: 2,
      assigned: 1,
      unassigned: 1,
      assignmentUnknown: 0,
      mapped: 1,
      unmapped: 1,
      scheduledMinutes: 240,
    });
    expect(payload.crew).toEqual([
      {
        jobberUserId: "tech-1",
        displayName: "Alex Tech",
        visitCount: 1,
        scheduledMinutes: 120,
      },
    ]);
    expect(payload.visits[0]).toMatchObject({
      address: "123 Main St, Chico, CA 95928",
      city: "Chico",
      homeAtlasVisitHref: "/hq/jobber#jobber-visit-visit-projection-1",
    });
  });

  it("does not label hidden crew data as unassigned", () => {
    const payload = buildOwnerDispatchPayload({
      month: "2026-08",
      connected: true,
      connectionStatus: "connected",
      accountName: null,
      lastSyncedAt: null,
      projections: [
        projection({
          raw_payload: { assignmentReadState: "permission_hidden" },
        }),
      ],
      geocodes: [],
    });
    expect(payload.summary.unassigned).toBe(0);
    expect(payload.summary.assignmentUnknown).toBe(1);
  });
});
