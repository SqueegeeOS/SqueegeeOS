import { describe, expect, it } from "vitest";
import { calculateAssessmentOverallScore } from "./assessment-types";

describe("assessment scoring", () => {
  it("excludes NA areas from overall score", () => {
    const score = calculateAssessmentOverallScore(
      {
        window_health: 4,
        screen_health: 5,
        roof_condition: null,
      },
      ["window_health", "screen_health", "roof_condition"],
      ["roof_condition"],
    );
    expect(score).toBe(90);
  });

  it("returns null when nothing is scoreable", () => {
    const score = calculateAssessmentOverallScore(
      { window_health: null },
      ["window_health"],
      ["window_health"],
    );
    expect(score).toBeNull();
  });

  it("ignores areas not yet scored", () => {
    const score = calculateAssessmentOverallScore(
      { window_health: 3 },
      ["window_health", "screen_health"],
      [],
    );
    expect(score).toBe(60);
  });
});
