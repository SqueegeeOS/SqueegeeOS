import { describe, expect, it } from "vitest";
import {
  calculateOverallScore,
  emptyHealthScores,
  type HealthScores,
} from "./types";

describe("health types", () => {
  it("calculates overall score from scored categories only", () => {
    const scores: HealthScores = {
      ...emptyHealthScores(),
      windowHealth: 4,
      screenHealth: 5,
      hardWaterRisk: 3,
    };

    expect(calculateOverallScore(scores)).toBe(80);
  });

  it("returns null when no categories are scored", () => {
    expect(calculateOverallScore(emptyHealthScores())).toBeNull();
  });

  it("rounds to one decimal place", () => {
    const scores: HealthScores = {
      ...emptyHealthScores(),
      windowHealth: 4,
      screenHealth: 4,
      hardWaterRisk: 3,
    };

    expect(calculateOverallScore(scores)).toBe(73.3);
  });
});
