import { describe, expect, it } from "vitest";
import { calculateCarePlanPricing } from "./care-plan";
import { createDefaultPresentation } from "./repository";
import { createSalesServiceInterestPresentationSeed } from "./sales-service-interest-seed";

describe("sales service interest presentation seed", () => {
  it("keeps an exterior-only lead on the fast simple plan", () => {
    const seed = createSalesServiceInterestPresentationSeed({
      tier: "quarterly",
      serviceInterests: ["exterior_windows"],
    });

    expect(seed.planMode).toBe("simple");
    expect(seed.carePlan.visits).toHaveLength(4);
    expect(seed.carePlan.visits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          interiorWindows: "not_included",
          screens: "not_included",
          cobwebRemoval: "not_included",
        }),
      ]),
    );
  });

  it("carries discussed add-ons as optional without increasing price", () => {
    const seed = createSalesServiceInterestPresentationSeed({
      tier: "triannual",
      serviceInterests: [
        "exterior_windows",
        "interior_windows",
        "screens",
        "cobweb_removal",
      ],
    });
    const pricing = calculateCarePlanPricing({
      plan: seed.carePlan,
      baseVisitPrice: 200,
    });

    expect(seed.planMode).toBe("custom");
    expect(seed.carePlan.visits).toHaveLength(3);
    for (const visit of seed.carePlan.visits) {
      expect(visit).toMatchObject({
        interiorWindows: "optional",
        screens: "optional",
        cobwebRemoval: "optional",
      });
    }
    expect(pricing.annualTotal).toBe(600);
    expect(seed.carePlan.customerChoiceNote).toContain(
      "confirmed in this plan before signing",
    );
  });

  it("does not manufacture structured scope for an unspecified other service", () => {
    const seed = createSalesServiceInterestPresentationSeed({
      tier: "biannual",
      serviceInterests: ["exterior_windows", "other"],
    });

    expect(seed.planMode).toBe("simple");
    expect(seed.carePlan.visits[0]?.screens).toBe("not_included");
  });

  it("wires a field lead's interest seed into the actual new presentation", () => {
    const exteriorOnly = createDefaultPresentation({ tier: "quarterly" });
    const presentation = createDefaultPresentation({
      clientName: "Rehearsal Homeowner",
      tier: "quarterly",
      serviceInterests: ["exterior_windows", "screens"],
    });

    expect(presentation.planMode).toBe("custom");
    expect(
      presentation.carePlan.visits.every(
        (visit) => visit.screens === "optional",
      ),
    ).toBe(true);
    expect(presentation.annualRate).toBe(exteriorOnly.annualRate);
  });
});
