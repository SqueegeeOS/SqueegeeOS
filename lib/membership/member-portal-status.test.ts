import { describe, expect, it } from "vitest";
import {
  CADENCE_LABEL,
  inferMembershipCadence,
  MEMBER_ADD_ON_DISCOUNT,
  SERVICE_SUMMARY,
} from "./member-portal-status";

describe("member portal cadence", () => {
  it.each([
    "Tri-Annual Care",
    "3x per year",
    "3× Per Year",
    "Three-times yearly care",
  ])("recognizes optional three-visit plans: %s", (planName) => {
    expect(inferMembershipCadence(planName)).toBe("triannual");
  });

  it("uses truthful 3x/year member copy and benefits", () => {
    expect(CADENCE_LABEL.triannual).toBe("3× Per Year");
    expect(SERVICE_SUMMARY.triannual).toContain("every four months");
    expect(MEMBER_ADD_ON_DISCOUNT.triannual).toBe(20);
  });
});
