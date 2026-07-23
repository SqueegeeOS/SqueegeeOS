import type { HomeCarePlanDraft } from "@/lib/home-care-plan/create-types";
import type { CompanySettings } from "@/lib/pricing/company-settings";
import {
  calculateWindowCarePricing,
  validateInput,
} from "@/lib/pricing/window-care-pricing";

export class HomeCarePlanPricingInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HomeCarePlanPricingInputError";
  }
}

/**
 * Replace legacy presentation-only price fields with Atlas Pricing Engine
 * output. The incoming strings are never pricing authority.
 */
export function applyAtlasPricingToHomeCarePlanDraft(
  draft: HomeCarePlanDraft,
  settings: CompanySettings,
): HomeCarePlanDraft {
  const pricingInput = {
    squareFeet: Number.parseInt(draft.property.squareFeet, 10),
    frequency: draft.careFrequency,
    includeInterior: draft.includeInteriorGlass,
  };
  const validationError = validateInput(pricingInput, settings);
  if (validationError) {
    throw new HomeCarePlanPricingInputError(validationError);
  }

  const output = calculateWindowCarePricing(pricingInput, undefined, settings);
  return {
    ...draft,
    membershipOneTimePrice: String(output.exteriorOneTimePrice),
    membershipPreferredPrice: String(output.exteriorMemberPrice),
    membershipEstatePrice: String(output.interiorExteriorMemberPrice),
    standardPricingApplied: true,
    standardPricingNote: "Screens are not included in base pricing.",
  };
}
