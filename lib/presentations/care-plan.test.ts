import { describe, expect, it } from "vitest";
import {
  applyCarePlanPreset,
  calculateCarePlanPricing,
  createDefaultCarePlan,
  normalizeCarePlan,
  resizeCarePlan,
  summarizeCarePlan,
} from "./care-plan";

describe("presentation care plans", () => {
  it("creates the correct number of visits for every cadence", () => {
    expect(createDefaultCarePlan({ tier: "biannual" }).visits).toHaveLength(2);
    expect(createDefaultCarePlan({ tier: "triannual" }).visits).toHaveLength(3);
    expect(createDefaultCarePlan({ tier: "quarterly" }).visits).toHaveLength(4);
  });

  it("keeps the simple-plan summary aligned with included services", () => {
    const plan = createDefaultCarePlan({
      tier: "biannual",
      includeInterior: true,
      includeScreens: true,
    });
    expect(plan.summary).toContain("Interior windows");
    expect(plan.summary).toContain("screens");
    expect(plan.visits.every((visit) => visit.interiorWindows === "included")).toBe(true);
  });

  it("models exterior quarterly with one annual interior visit", () => {
    const plan = applyCarePlanPreset(
      createDefaultCarePlan({ tier: "quarterly" }),
      "annual_interior",
    );

    expect(
      plan.visits.filter((visit) => visit.interiorWindows === "included"),
    ).toHaveLength(1);
    expect(plan.visits.every((visit) => visit.screens === "not_included")).toBe(
      true,
    );
    expect(summarizeCarePlan(plan)).toBe("Exterior 4×/yr · interior 1×");
  });

  it("supports screens as a customer-selected add-on instead of silently including them", () => {
    const plan = createDefaultCarePlan({ tier: "quarterly" });
    plan.visits = plan.visits.map((visit) => ({
      ...visit,
      screens: "optional",
    }));

    expect(summarizeCarePlan(plan)).toBe(
      "Exterior 4×/yr · screens optional",
    );
  });

  it("calculates mixed visit totals and annual value", () => {
    const plan = applyCarePlanPreset(
      createDefaultCarePlan({ tier: "quarterly" }),
      "annual_interior",
    );
    plan.visits[1] = {
      ...plan.visits[1]!,
      screens: "included",
    };
    const pricing = calculateCarePlanPricing({
      plan,
      baseVisitPrice: 200,
    });

    expect(pricing.visits.map((visit) => visit.total)).toEqual([
      300, 250, 200, 200,
    ]);
    expect(pricing.annualTotal).toBe(950);
    expect(pricing.averageVisitPrice).toBe(237.5);
  });

  it("uses a per-visit override as the final visit total", () => {
    const plan = createDefaultCarePlan({
      tier: "biannual",
      includeInterior: true,
      includeScreens: true,
    });
    plan.visits[0] = { ...plan.visits[0]!, priceOverride: 425 };
    const pricing = calculateCarePlanPricing({
      plan,
      baseVisitPrice: 200,
    });

    expect(pricing.visits[0]).toMatchObject({ total: 425, usedOverride: true });
    expect(pricing.visits[1]?.total).toBe(350);
  });

  it("normalizes unsafe model output and resizes safely when cadence changes", () => {
    const fallback = createDefaultCarePlan({ tier: "biannual" });
    const normalized = normalizeCarePlan(
      {
        tier: "quarterly",
        summary: "  Custom plan  ",
        visits: [
          {
            id: "custom",
            label: "Spring",
            timing: "March",
            interiorWindows: "included",
            screens: "made_up",
            priceOverride: -10,
          },
        ],
      },
      fallback,
    );

    expect(normalized.visits).toHaveLength(4);
    expect(normalized.visits[0]).toMatchObject({
      label: "Spring",
      interiorWindows: "included",
      screens: "not_included",
      priceOverride: null,
    });
    expect(resizeCarePlan(normalized, "triannual").visits).toHaveLength(3);
  });
});
