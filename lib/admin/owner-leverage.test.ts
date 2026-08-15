import { describe, expect, it } from "vitest";
import type { FieldIndependenceReview } from "@/lib/field-operations/independence-review";
import {
  calculateOwnerLeverageMetrics,
  classifyGrowthDay,
  type GrowthWorkSession,
} from "./owner-leverage";

const independentReview: FieldIndependenceReview = {
  id: "11111111-1111-4111-8111-111111111111",
  appointmentId: "22222222-2222-4222-8222-222222222222",
  propertyId: "33333333-3333-4333-8333-333333333333",
  externalVisitId: "visit-1",
  serviceDate: "2026-08-14",
  technicianJobberUserId: "jarad-jobber-id",
  technicianDisplayName: "Jarad",
  jobClass: "normal",
  ownerInvolvement: "none",
  ownerMinutes: 0,
  qualityOutcome: "verified",
  productionMinutes: 240,
  durationSource: "field_events",
  sourceVerifiedAt: "2026-08-14T19:00:00.000Z",
  reviewedBy: "HomeAtlas HQ",
  reviewNote: null,
  reviewedAt: "2026-08-14T20:00:00.000Z",
};

const session: GrowthWorkSession = {
  id: "44444444-4444-4444-8444-444444444444",
  operatorId: "55555555-5555-4555-8555-555555555555",
  operatorSlug: "noah",
  operatorName: "Noah Thomas",
  businessDate: "2026-08-14",
  channel: "door_to_door",
  status: "completed",
  startedAt: "2026-08-14T15:00:00.000Z",
  endedAt: "2026-08-14T19:30:00.000Z",
  breakMinutes: 30,
  notes: null,
};

describe("owner leverage metrics", () => {
  it("ties bought-back time, growth time, and attributed signed ARR together", () => {
    const result = calculateOwnerLeverageMetrics({
      today: "2026-08-14",
      reviews: [{ review: independentReview, hasOpenException: false }],
      sessions: [session],
      attributedCloses: [
        {
          arrCents: 120_000,
          attributedAt: "2026-08-14T18:00:00.000Z",
          businessDate: "2026-08-14",
          operatorId: session.operatorId,
        },
      ],
      presentationCohort: [
        { id: "presentation-1", operatorId: session.operatorId, signedAt: "now" },
        { id: "presentation-2", operatorId: session.operatorId, signedAt: null },
      ],
      leadsCreated: 5,
    });

    expect(result.ownerFieldHoursBoughtBack).toBe(4);
    expect(result.independentJobs).toBe(1);
    expect(result.growthHours).toBe(4);
    expect(result.dedicatedGrowthDays).toBe(1);
    expect(result.newAttributedArr).toBe(1_200);
    expect(result.newArrPerGrowthHour).toBe(300);
    expect(result.newArrPerDedicatedGrowthDay).toBe(1_200);
    expect(result.growthDayBand).toBe("target");
    expect(result.presentationCloseRate).toBe(50);
    expect(result.nextBuybackTargetHours).toBe(8);
    expect(result.buybackProgressPercent).toBe(50);
    expect(result.today.independentJobs).toBe(1);
  });

  it("excludes an open exception from bought-back time", () => {
    const result = calculateOwnerLeverageMetrics({
      today: "2026-08-14",
      reviews: [{ review: independentReview, hasOpenException: true }],
      sessions: [],
      attributedCloses: [],
      presentationCohort: [],
      leadsCreated: 0,
    });

    expect(result.reviewedJobs).toBe(1);
    expect(result.independentJobs).toBe(0);
    expect(result.ownerFieldHoursBoughtBack).toBe(0);
    expect(result.qualityExceptionJobs).toBe(1);
  });

  it("does not turn a partial selling block into a dedicated growth day", () => {
    const result = calculateOwnerLeverageMetrics({
      today: "2026-08-14",
      reviews: [],
      sessions: [
        {
          ...session,
          endedAt: "2026-08-14T18:00:00.000Z",
          breakMinutes: 0,
        },
      ],
      attributedCloses: [],
      presentationCohort: [],
      leadsCreated: 0,
    });

    expect(result.growthHours).toBe(3);
    expect(result.dedicatedGrowthDays).toBe(0);
    expect(result.newArrPerDedicatedGrowthDay).toBeNull();
  });

  it("does not inflate a dedicated day with ARR signed on an off-clock date", () => {
    const result = calculateOwnerLeverageMetrics({
      today: "2026-08-14",
      reviews: [],
      sessions: [session],
      attributedCloses: [
        {
          arrCents: 60_000,
          attributedAt: "2026-08-14T18:00:00.000Z",
          businessDate: "2026-08-14",
          operatorId: session.operatorId,
        },
        {
          arrCents: 200_000,
          attributedAt: "2026-08-15T18:00:00.000Z",
          businessDate: "2026-08-15",
          operatorId: session.operatorId,
        },
      ],
      presentationCohort: [],
      leadsCreated: 0,
    });

    expect(result.newAttributedArr).toBe(2_600);
    expect(result.newArrPerDedicatedGrowthDay).toBe(600);
    expect(result.growthDayBand).toBe("floor");
  });

  it("uses the operating brief's ARR-per-day bands", () => {
    expect(classifyGrowthDay(499)).toBe("below_floor");
    expect(classifyGrowthDay(500)).toBe("floor");
    expect(classifyGrowthDay(1_000)).toBe("target");
    expect(classifyGrowthDay(2_000)).toBe("excellent");
  });
});
