import { describe, expect, it } from "vitest";
import {
  buildStandardRepProfile,
  DAVID_REP_PROFILE,
  getMilestoneProgress,
} from "./rep-config";

describe("sales rep compensation profiles", () => {
  it("reserves the founding benefit stack for David", () => {
    const standard = buildStandardRepProfile({
      slug: "future-rep",
      displayName: "Future Rep",
    });

    expect(DAVID_REP_PROFILE.plan).toBe("founding_david");
    expect(DAVID_REP_PROFILE.isFoundingRep).toBe(true);
    expect(DAVID_REP_PROFILE.milestones).toHaveLength(5);
    expect(standard.plan).toBe("standard_commission");
    expect(standard.isFoundingRep).toBe(false);
    expect(standard.milestones).toEqual([]);
    expect(standard.benefits.map((benefit) => benefit.title)).not.toContain(
      "Founder equity milestones",
    );
  });

  it("models David's 12-month retained-member milestones without issuing benefits", () => {
    expect(DAVID_REP_PROFILE.retentionQualificationMonths).toBe(12);
    expect(getMilestoneProgress(DAVID_REP_PROFILE, 24)).toMatchObject({
      modeledEquityPercent: 0,
      nextMilestone: { retainedMembers: 25, modeledEquityPercent: 1 },
      progressPercent: 96,
    });
    expect(getMilestoneProgress(DAVID_REP_PROFILE, 50)).toMatchObject({
      modeledEquityPercent: 2,
      nextMilestone: { retainedMembers: 75, modeledEquityPercent: 3 },
      progressPercent: 0,
    });
    expect(getMilestoneProgress(DAVID_REP_PROFILE, 125)).toMatchObject({
      modeledEquityPercent: 5,
      nextMilestone: null,
      progressPercent: 100,
    });
  });
});
