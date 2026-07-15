import { describe, expect, it } from "vitest";
import { emptyHomeCarePlanDraft } from "@/lib/home-care-plan/create-types";
import { DEFAULT_COMPANY_SETTINGS } from "@/lib/pricing/company-settings";
import {
  applyAtlasPricingToHomeCarePlanDraft,
  HomeCarePlanPricingInputError,
} from "./atlas-pricing";

describe("Home Care Plan Atlas pricing authority", () => {
  it("overwrites every client-supplied price with existing engine output", () => {
    const priced = applyAtlasPricingToHomeCarePlanDraft(
      {
        ...emptyHomeCarePlanDraft,
        membershipOneTimePrice: "1",
        membershipPreferredPrice: "2",
        membershipEstatePrice: "3",
        standardPricingApplied: false,
      },
      DEFAULT_COMPANY_SETTINGS,
    );

    expect(priced.membershipOneTimePrice).not.toBe("1");
    expect(priced.membershipPreferredPrice).not.toBe("2");
    expect(priced.membershipEstatePrice).not.toBe("3");
    expect(priced.standardPricingApplied).toBe(true);
  });

  it("uses the engine's existing input validation", () => {
    expect(() =>
      applyAtlasPricingToHomeCarePlanDraft(
        {
          ...emptyHomeCarePlanDraft,
          property: { ...emptyHomeCarePlanDraft.property, squareFeet: "1" },
        },
        DEFAULT_COMPANY_SETTINGS,
      ),
    ).toThrow(HomeCarePlanPricingInputError);
  });
});
