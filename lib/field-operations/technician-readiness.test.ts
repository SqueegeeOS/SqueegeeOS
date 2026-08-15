import { describe, expect, it } from "vitest";
import {
  TECHNICIAN_COMPETENCIES,
  deriveIndependentDayOutcome,
  deriveTechnicianReadiness,
  validateIndependentDayPlanInput,
  validateTechnicianCompetencyInput,
  type TechnicianCompetencyAssessment,
} from "./technician-readiness";

function assessments(
  rating: TechnicianCompetencyAssessment["rating"],
): TechnicianCompetencyAssessment[] {
  return TECHNICIAN_COMPETENCIES.map((competency, index) => ({
    id: `assessment-${index}`,
    jobberUserId: "jarad-jobber-id",
    displayName: "Jarad",
    competency: competency.id,
    rating,
    evidenceNote: "Observed on the supervised route with complete evidence.",
    sourceAppointmentId: null,
    assessedBy: "HomeAtlas HQ",
    assessedAt: `2026-08-${String(10 + index).padStart(2, "0")}T18:00:00.000Z`,
  }));
}

describe("technician readiness", () => {
  it("requires a usable pass, every competency, and real independent work", () => {
    const result = deriveTechnicianReadiness({
      jobberUserId: "jarad-jobber-id",
      displayName: "Jarad",
      fieldPassState: "active",
      assessments: assessments("independent"),
      independentJobs: 2,
      independentMinutes: 330,
      ownerInterventionJobs: 1,
      qualityExceptionJobs: 0,
      lastIndependentServiceDate: "2026-08-14",
    });

    expect(result.evidenceCompleteForOwnerDecision).toBe(true);
    expect(result.independentCompetencyCount).toBe(8);
    expect(result.independentHours).toBe(5.5);
    expect(result.evidenceGates.every((gate) => gate.passed)).toBe(true);
  });

  it("uses the latest assessment and never averages old evidence", () => {
    const complete = assessments("independent");
    const result = deriveTechnicianReadiness({
      jobberUserId: "jarad-jobber-id",
      displayName: "Jarad",
      fieldPassState: "active",
      assessments: [
        ...complete,
        {
          ...complete[0]!,
          id: "newer-refresh",
          rating: "supervised",
          assessedAt: "2026-09-01T18:00:00.000Z",
        },
      ],
      independentJobs: 1,
      independentMinutes: 120,
      ownerInterventionJobs: 0,
      qualityExceptionJobs: 0,
      lastIndependentServiceDate: "2026-08-14",
    });

    expect(result.independentCompetencyCount).toBe(7);
    expect(result.evidenceCompleteForOwnerDecision).toBe(false);
  });

  it("verifies an independent day only when every scheduled stop qualifies", () => {
    expect(
      deriveIndependentDayOutcome({
        status: "planned",
        trialDate: "2026-08-14",
        today: "2026-08-14",
        jobberConnected: true,
        scheduledStops: 4,
        completedStops: 4,
        reviewedStops: 4,
        qualifyingIndependentStops: 4,
      }),
    ).toBe("verified");
    expect(
      deriveIndependentDayOutcome({
        status: "planned",
        trialDate: "2026-08-14",
        today: "2026-08-14",
        jobberConnected: true,
        scheduledStops: 4,
        completedStops: 4,
        reviewedStops: 3,
        qualifyingIndependentStops: 3,
      }),
    ).toBe("needs_review");
  });

  it("fails closed when Jobber is disconnected or no route exists", () => {
    expect(
      deriveIndependentDayOutcome({
        status: "planned",
        trialDate: "2026-08-13",
        today: "2026-08-14",
        jobberConnected: false,
        scheduledStops: 3,
        completedStops: 3,
        reviewedStops: 3,
        qualifyingIndependentStops: 3,
      }),
    ).toBe("source_unavailable");
    expect(
      deriveIndependentDayOutcome({
        status: "planned",
        trialDate: "2026-08-14",
        today: "2026-08-14",
        jobberConnected: true,
        scheduledStops: 0,
        completedStops: 0,
        reviewedStops: 0,
        qualifyingIndependentStops: 0,
      }),
    ).toBe("needs_schedule");
    expect(
      deriveIndependentDayOutcome({
        status: "planned",
        trialDate: "2026-08-14",
        today: "2026-08-14",
        jobberConnected: true,
        assignmentEvidenceAvailable: false,
        scheduledStops: 2,
        completedStops: 2,
        reviewedStops: 2,
        qualifyingIndependentStops: 2,
      }),
    ).toBe("source_unavailable");
  });

  it("requires useful assessment evidence and a real calendar date", () => {
    expect(
      validateTechnicianCompetencyInput({
        jobberUserId: "jarad-jobber-id",
        displayName: "Jarad",
        competency: "service_quality",
        rating: "independent",
        evidenceNote: "too short",
      }),
    ).toContain("between 10 and 1,000");
    expect(
      validateIndependentDayPlanInput({
        jobberUserId: "jarad-jobber-id",
        displayName: "Jarad",
        trialDate: "tomorrow",
      }),
    ).toContain("valid trial date");
  });
});
