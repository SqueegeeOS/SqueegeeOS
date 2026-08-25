import { describe, expect, it } from "vitest";
import {
  selectLinkedMembershipJobberVisits,
  selectPairedJobberNextVisit,
} from "./jobber-hq-schedule";

const link = {
  connection_id: "squeegeeking",
  external_property_id: "jobber-property-1",
  property_id: "homeatlas-property-1",
  membership_id: "membership-1",
};

const membershipJobLink = {
  connection_id: "squeegeeking",
  external_job_id: "job-1",
  external_property_id: "jobber-property-1",
  property_id: "homeatlas-property-1",
  membership_id: "membership-1",
};

function visit(overrides: Partial<ReturnType<typeof baseVisit>> = {}) {
  return { ...baseVisit(), ...overrides };
}

function baseVisit() {
  return {
    connection_id: "squeegeeking",
    external_property_id: "jobber-property-1",
    external_visit_id: "visit-1",
    external_job_id: "job-1",
    scheduled_start: "2026-09-10T17:00:00.000Z",
    scheduled_end: "2026-09-10T19:00:00.000Z",
    title: "Exterior windows",
    visit_status: "UPCOMING",
    is_complete: false,
  };
}

describe("HQ paired Jobber schedule", () => {
  it("uses the nearest future visit only after the exact property pair", () => {
    expect(
      selectPairedJobberNextVisit({
        membershipId: "membership-1",
        propertyId: "homeatlas-property-1",
        propertyLinks: [link],
        membershipJobLinks: [membershipJobLink],
        projections: [
          visit({
            external_visit_id: "later",
            scheduled_start: "2026-10-10T17:00:00.000Z",
          }),
          visit({ external_visit_id: "nearest" }),
        ],
        referenceDate: new Date("2026-08-16T12:00:00.000Z"),
      })?.external_visit_id,
    ).toBe("nearest");
  });

  it("does not infer a schedule across memberships or properties", () => {
    expect(
      selectPairedJobberNextVisit({
        membershipId: "another-membership",
        propertyId: "homeatlas-property-1",
        propertyLinks: [link],
        membershipJobLinks: [membershipJobLink],
        projections: [visit()],
        referenceDate: new Date("2026-08-16T12:00:00.000Z"),
      }),
    ).toBeNull();
  });

  it("rejects cancelled, completed, removed, and past visits", () => {
    expect(
      selectPairedJobberNextVisit({
        membershipId: "membership-1",
        propertyId: "homeatlas-property-1",
        propertyLinks: [link],
        membershipJobLinks: [membershipJobLink],
        projections: [
          visit({ visit_status: "CANCELLED" }),
          visit({ external_visit_id: "complete", is_complete: true }),
          visit({ external_visit_id: "removed", visit_status: "REMOVED" }),
          visit({
            external_visit_id: "past",
            scheduled_start: "2026-07-10T17:00:00.000Z",
          }),
        ],
        referenceDate: new Date("2026-08-16T12:00:00.000Z"),
      }),
    ).toBeNull();
  });

  it("keeps add-on jobs at the property out of membership visit progress", () => {
    const membershipVisits = selectLinkedMembershipJobberVisits({
      membershipId: "membership-1",
      propertyId: "homeatlas-property-1",
      propertyLinks: [link],
      membershipJobLinks: [membershipJobLink],
      projections: [
        visit({ external_visit_id: "cleaning" }),
        visit({
          external_visit_id: "screen-door",
          external_job_id: "screen-door-job",
          title: "Screen door replacement and installation",
        }),
      ],
    });

    expect(membershipVisits.map((projection) => projection.external_visit_id)).toEqual([
      "cleaning",
    ]);
  });
});
