import { describe, expect, it } from "vitest";
import { canyonOaksHomeCarePlan } from "./canyon-oaks";
import {
  getPlanPresentationPath,
  isHomeCarePlanCapability,
} from "./presentation-capability";

const capability = "11111111-1111-4111-8111-111111111111";

describe("Home Care Plan presentation capability", () => {
  it("builds a UUID-bound cloud path alongside both readable slugs", () => {
    expect(getPlanPresentationPath(canyonOaksHomeCarePlan, capability)).toBe(
      `/homecare/${canyonOaksHomeCarePlan.homeowner.slug}/${canyonOaksHomeCarePlan.property.slug}/plan/${capability}`,
    );
  });

  it("preserves the slug-only local demo path when no capability is supplied", () => {
    expect(getPlanPresentationPath(canyonOaksHomeCarePlan)).toBe(
      `/homecare/${canyonOaksHomeCarePlan.homeowner.slug}/${canyonOaksHomeCarePlan.property.slug}/plan`,
    );
  });

  it("rejects malformed capabilities", () => {
    expect(isHomeCarePlanCapability(capability)).toBe(true);
    expect(isHomeCarePlanCapability("guessable-plan")).toBe(false);
    expect(() =>
      getPlanPresentationPath(canyonOaksHomeCarePlan, "guessable-plan"),
    ).toThrow("Invalid Home Care Plan presentation capability");
  });
});
