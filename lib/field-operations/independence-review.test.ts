import { describe, expect, it } from "vitest";
import {
  fieldReviewCountsAsBoughtBackTime,
  resolveVerifiedProductionDuration,
  validateFieldIndependenceReviewInput,
  type FieldIndependenceReview,
} from "./independence-review";

const baseReview: FieldIndependenceReview = {
  id: "11111111-1111-4111-8111-111111111111",
  appointmentId: "22222222-2222-4222-8222-222222222222",
  propertyId: "33333333-3333-4333-8333-333333333333",
  externalVisitId: "jobber-visit-1",
  serviceDate: "2026-08-14",
  technicianJobberUserId: "jobber-user-jarad",
  technicianDisplayName: "Jarad",
  jobClass: "normal",
  ownerInvolvement: "none",
  ownerMinutes: 0,
  qualityOutcome: "verified",
  productionMinutes: 180,
  durationSource: "field_events",
  sourceVerifiedAt: "2026-08-14T20:00:00.000Z",
  reviewedBy: "HomeAtlas HQ",
  reviewNote: null,
  reviewedAt: "2026-08-14T21:00:00.000Z",
};

describe("field independence reviews", () => {
  it("counts only a normal, verified, zero-owner visit with measured time", () => {
    expect(fieldReviewCountsAsBoughtBackTime(baseReview)).toBe(true);
    expect(
      fieldReviewCountsAsBoughtBackTime({
        ...baseReview,
        ownerInvolvement: "remote_guidance",
      }),
    ).toBe(false);
    expect(
      fieldReviewCountsAsBoughtBackTime({
        ...baseReview,
        qualityOutcome: "rework",
      }),
    ).toBe(false);
    expect(
      fieldReviewCountsAsBoughtBackTime({
        ...baseReview,
        jobClass: "exceptional",
      }),
    ).toBe(false);
    expect(fieldReviewCountsAsBoughtBackTime(baseReview, true)).toBe(false);
  });

  it("prefers actual service events over the scheduled window", () => {
    expect(
      resolveVerifiedProductionDuration({
        serviceStartedAt: "2026-08-14T16:00:00.000Z",
        serviceCompletedAt: "2026-08-14T18:30:00.000Z",
        scheduledStart: "2026-08-14T15:00:00.000Z",
        scheduledEnd: "2026-08-14T19:00:00.000Z",
      }),
    ).toEqual({ minutes: 150, source: "field_events" });
  });

  it("falls back to Jobber schedule without inventing missing time", () => {
    expect(
      resolveVerifiedProductionDuration({
        serviceStartedAt: null,
        serviceCompletedAt: null,
        scheduledStart: "2026-08-14T15:00:00.000Z",
        scheduledEnd: "2026-08-14T19:00:00.000Z",
      }),
    ).toEqual({ minutes: 240, source: "jobber_schedule" });
    expect(
      resolveVerifiedProductionDuration({
        serviceStartedAt: null,
        serviceCompletedAt: null,
        scheduledStart: "2026-08-14T15:00:00.000Z",
        scheduledEnd: null,
      }),
    ).toEqual({ minutes: null, source: "unavailable" });
  });

  it("rejects contradictory owner-time evidence", () => {
    expect(
      validateFieldIndependenceReviewInput({
        appointmentId: baseReview.appointmentId,
        propertyId: baseReview.propertyId,
        technicianJobberUserId: baseReview.technicianJobberUserId,
        jobClass: "normal",
        ownerInvolvement: "none",
        ownerMinutes: 15,
        qualityOutcome: "verified",
      }),
    ).toContain("zero owner minutes");
    expect(
      validateFieldIndependenceReviewInput({
        appointmentId: baseReview.appointmentId,
        propertyId: baseReview.propertyId,
        technicianJobberUserId: baseReview.technicianJobberUserId,
        jobClass: "normal",
        ownerInvolvement: "onsite_assist",
        ownerMinutes: 0,
        qualityOutcome: "verified",
      }),
    ).toContain("at least one owner minute");
  });
});
