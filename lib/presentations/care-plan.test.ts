import { describe, expect, it } from "vitest";
import {
  applyCarePlanServicePolicy,
  applyCarePlanPreset,
  calculateCarePlanPricing,
  createDefaultCarePlan,
  deriveCarePlanServicePolicy,
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

  it("applies one clear service policy across visits and keeps selected visits editable", () => {
    const base = createDefaultCarePlan({ tier: "quarterly" });
    const optional = applyCarePlanServicePolicy(
      base,
      "interiorWindows",
      "optional_add_on",
    );
    expect(
      optional.visits.every((visit) => visit.interiorWindows === "optional"),
    ).toBe(true);
    expect(deriveCarePlanServicePolicy(optional, "interiorWindows")).toBe(
      "optional_add_on",
    );

    const selected = applyCarePlanServicePolicy(
      optional,
      "interiorWindows",
      "selected_visits",
    );
    expect(selected.visits[0]?.interiorWindows).toBe("included");
    expect(
      selected.visits.slice(1).every(
        (visit) => visit.interiorWindows === "not_included",
      ),
    ).toBe(true);
    expect(deriveCarePlanServicePolicy(selected, "interiorWindows")).toBe(
      "selected_visits",
    );
  });

  it("prices cobwebbing only when it is deliberately included", () => {
    const optional = applyCarePlanPreset(
      createDefaultCarePlan({ tier: "biannual" }),
      "flexible_add_ons",
    );
    expect(calculateCarePlanPricing({ plan: optional, baseVisitPrice: 200 }).annualTotal).toBe(
      400,
    );

    const included = applyCarePlanServicePolicy(
      optional,
      "cobwebRemoval",
      "always_included",
    );
    expect(calculateCarePlanPricing({ plan: included, baseVisitPrice: 200 }).annualTotal).toBe(
      500,
    );
    expect(summarizeCarePlan(included)).toContain("cobwebs every visit");
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
      exteriorWindows: "included",
      interiorWindows: "included",
      screens: "not_included",
      cobwebRemoval: "not_included",
      solarPanels: "not_included",
      pressureWashing: "not_included",
      priceOverride: null,
    });
    expect(normalized.servicePrices).toEqual({
      interiorWindows: 100,
      screens: 50,
      cobwebRemoval: 50,
      solarPanels: 0,
      pressureWashing: 0,
      gutterCleaning: 0,
    });
    expect(resizeCarePlan(normalized, "triannual").visits).toHaveLength(3);
  });

  it("supports a solar and exterior rotation without inventing property-specific prices", () => {
    const plan = applyCarePlanPreset(
      createDefaultCarePlan({ tier: "quarterly" }),
      "solar_window_rotation",
    );
    const pricing = calculateCarePlanPricing({
      plan,
      baseVisitPrice: 200,
      solarPanelsAddOn: 150,
    });

    expect(plan.visits.map((visit) => visit.exteriorWindows)).toEqual([
      "not_included",
      "included",
      "not_included",
      "included",
    ]);
    expect(plan.visits.map((visit) => visit.solarPanels)).toEqual([
      "included",
      "included",
      "included",
      "not_included",
    ]);
    expect(pricing.visits.map((visit) => visit.total)).toEqual([
      150, 350, 150, 200,
    ]);
    expect(summarizeCarePlan(plan)).toContain("solar panels 3×");
  });
  it("supports gutters on selected visits, optional visits, and every visit without invented prices", () => {
    const base = createDefaultCarePlan({ tier: "biannual" });
    expect(base.servicePrices.gutterCleaning).toBe(0);
    expect(base.visits.every((visit) => visit.gutterCleaning === "not_included")).toBe(true);
    const selected = applyCarePlanServicePolicy(base, "gutterCleaning", "selected_visits");
    selected.servicePrices.gutterCleaning = 150;
    expect(selected.visits.map((visit) => visit.gutterCleaning)).toEqual(["included", "not_included"]);
    expect(summarizeCarePlan(selected)).toContain("gutters 1×");
    expect(calculateCarePlanPricing({ plan: selected, baseVisitPrice: 300 }).annualTotal).toBe(750);
    const optional = applyCarePlanServicePolicy(selected, "gutterCleaning", "optional_add_on");
    expect(summarizeCarePlan(optional)).toContain("gutters optional");
    expect(calculateCarePlanPricing({ plan: optional, baseVisitPrice: 300 }).annualTotal).toBe(600);
    const included = applyCarePlanServicePolicy(optional, "gutterCleaning", "always_included");
    expect(summarizeCarePlan(included)).toContain("gutters every visit");
    expect(deriveCarePlanServicePolicy(included, "gutterCleaning")).toBe("always_included");
    expect(calculateCarePlanPricing({ plan: included, baseVisitPrice: 300 }).annualTotal).toBe(900);
    expect(applyCarePlanPreset(included, "exterior_only").visits.every((visit) => visit.gutterCleaning === "not_included")).toBe(true);
  });

  it("round-trips gutter scope and prices while keeping old plans unchanged", () => {
    const base = createDefaultCarePlan({ tier: "biannual" });
    const old = JSON.parse(JSON.stringify(base));
    old.version = 3;
    delete old.servicePrices.gutterCleaning;
    old.visits.forEach((visit: Record<string, unknown>) => {
      delete visit.gutterCleaning;
      visit.notes = "Gutters discussed, not included.";
      visit.priceOverride = 714;
    });
    const normalized = normalizeCarePlan(old, base);
    expect(normalized.visits.every((visit) => visit.gutterCleaning === "not_included")).toBe(true);
    expect(calculateCarePlanPricing({ plan: normalized, baseVisitPrice: 300 }).annualTotal).toBe(1428);
    const included = applyCarePlanServicePolicy(normalized, "gutterCleaning", "always_included");
    included.servicePrices.gutterCleaning = 150;
    expect(normalizeCarePlan(JSON.parse(JSON.stringify(included)), base)).toEqual(included);
    expect(resizeCarePlan(included, "quarterly").visits.map((visit) => visit.gutterCleaning)).toEqual(["included", "included", "not_included", "not_included"]);
    expect(calculateCarePlanPricing({ plan: included, baseVisitPrice: 300 }).annualTotal).toBe(1428);
  });

});
