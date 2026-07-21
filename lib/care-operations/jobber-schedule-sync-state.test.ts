import { describe, expect, it } from "vitest";
import {
  jobberCoverageActionLabel,
  jobberCoverageResultError,
} from "../../components/admin/jobber-schedule-sync-state";

describe("Jobber schedule sync continuation presentation", () => {
  it("presents a paused proof as a recoverable continuation", () => {
    expect(jobberCoverageActionLabel({
      refreshing: false,
      awaitingContinuation: true,
    })).toBe("Continue Jobber verification");
    expect(jobberCoverageResultError({
      httpStatus: 202,
      result: {
        outcome: "awaiting_continuation",
        failureCode: null,
        visitCount: 0,
      },
    })).toBeNull();
  });

  it("keeps concurrent, indeterminate, and partial results visibly fail closed", () => {
    expect(jobberCoverageResultError({
      httpStatus: 409,
      result: { outcome: "concurrent", failureCode: null, visitCount: 0 },
    })).toContain("already in progress");
    expect(jobberCoverageResultError({
      httpStatus: 202,
      result: {
        outcome: "indeterminate",
        failureCode: "finalization_indeterminate",
        visitCount: 0,
      },
    })).toContain("not yet known");
    expect(jobberCoverageResultError({
      httpStatus: 502,
      result: {
        outcome: "partial",
        failureCode: "malformed_response",
        visitCount: 0,
      },
    })).toContain("previous complete schedule was left unchanged");
  });
});
