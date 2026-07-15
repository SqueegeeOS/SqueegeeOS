import { describe, expect, it } from "vitest";
import { buildHomeCarePlanFromDraft } from "./builder";
import { emptyHomeCarePlanDraft } from "./create-types";

describe("Home Care Plan unknown-data authority", () => {
  it("keeps blank property history unknown and creates no synthetic findings", () => {
    const plan = buildHomeCarePlanFromDraft({
      ...emptyHomeCarePlanDraft,
      homeowner: { ...emptyHomeCarePlanDraft.homeowner, fullName: "Alex Kim" },
      property: {
        ...emptyHomeCarePlanDraft.property,
        name: "Kim Home",
        address: "1 Oak Way",
        yearBuilt: "",
        homeCareScore: "",
        lastVisit: "",
      },
      services: ["Window Cleaning"],
      findings: [],
    });

    expect(plan.property.yearBuilt).toBeNull();
    expect(plan.property.homeCareScore).toBeNull();
    expect(plan.property.lastVisit).toBeNull();
    expect(plan.findings).toEqual([]);
    expect(plan.propertyProfile.map((item) => item.label)).not.toContain(
      "Last Visit",
    );
    expect(plan.propertyProfile.map((item) => item.label)).not.toContain(
      "Home Care Score",
    );
    expect(plan.hero.intro).not.toContain("inspected");
  });
});
