import "server-only";

import type { HqActor } from "@/lib/auth/hq-access";
import {
  calculateExteriorAddOnQuote,
  getMemberAddOnDiscountPercent,
} from "@/lib/pricing/exterior-addon-pricing";
import { fetchPricingSettingsFromSupabase } from "@/lib/pricing/pricing-settings-server";
import {
  calculateWindowCarePricing,
  validateInput,
} from "@/lib/pricing/window-care-pricing";
import type { PricingOutput } from "@/lib/pricing/types";
import {
  type CreatePresentationAuthorityInput,
  type PatchPresentationAuthorityInput,
  type PresentationPricingAuthorityInput,
} from "@/lib/presentations/authority-input";
import {
  ATLAS_PRESENTATION_PRICING_AUTHORITY,
  buildPresentationQuoteSnapshot,
  careFrequencyToPresentationTier,
  isAuthoritativePresentationQuoteSnapshot,
  type PresentationQuoteSnapshot,
} from "@/lib/presentations/quote-snapshot";
import {
  createPresentation,
  getPresentation,
  patchPresentation,
} from "@/lib/presentations/repository";
import type { PresentationData } from "@/lib/presentations/types";
import { computePresentationAuthoritySha256 } from "@/lib/presentations/authority-hash";

export class PresentationAuthoringError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 | 503 = 400,
  ) {
    super(message);
    this.name = "PresentationAuthoringError";
  }
}

function scopedPrice(output: PricingOutput, includeInterior: boolean): number {
  return includeInterior
    ? output.interiorExteriorMemberPrice
    : output.exteriorMemberPrice;
}

function scopedEnrollmentSavings(
  output: PricingOutput,
  includeInterior: boolean,
): number {
  const oneTime = includeInterior
    ? output.interiorExteriorOneTimePrice
    : output.exteriorOneTimePrice;
  return Math.max(0, oneTime - scopedPrice(output, includeInterior));
}

async function buildServerPricingSnapshot(
  input: PresentationPricingAuthorityInput,
): Promise<PresentationQuoteSnapshot> {
  const settingsResult = await fetchPricingSettingsFromSupabase();
  if (settingsResult.error) {
    throw new PresentationAuthoringError(
      `Atlas Pricing Engine settings unavailable: ${settingsResult.error}`,
      503,
    );
  }

  const baseInput = {
    squareFeet: input.squareFeet,
    includeInterior: input.includeInterior,
    twoStory: input.twoStory,
    includeScreens: input.includeScreens,
  };
  const validationError = validateInput(
    { ...baseInput, frequency: input.frequency },
    settingsResult.settings,
  );
  if (validationError) {
    throw new PresentationAuthoringError(validationError);
  }

  const selectedPricing = calculateWindowCarePricing(
    { ...baseInput, frequency: input.frequency },
    undefined,
    settingsResult.settings,
  );
  const biannualPricing = calculateWindowCarePricing(
    { ...baseInput, frequency: "bi_annual" },
    undefined,
    settingsResult.settings,
  );
  const quarterlyPricing = calculateWindowCarePricing(
    { ...baseInput, frequency: "quarterly" },
    undefined,
    settingsResult.settings,
  );
  const addOnQuote = calculateExteriorAddOnQuote(
    input.squareFeet,
    input.exteriorAddOns,
    settingsResult.settings,
    {
      memberDiscountPercent: getMemberAddOnDiscountPercent(
        input.frequency,
        settingsResult.settings,
      ),
    },
  );

  return {
    ...buildPresentationQuoteSnapshot({
      sqft: input.squareFeet,
      frequency: input.frequency,
      includeInterior: input.includeInterior,
      twoStory: input.twoStory,
      includeScreens: input.includeScreens,
      pricing: selectedPricing,
      addOnQuote,
    }),
    authority: ATLAS_PRESENTATION_PRICING_AUTHORITY,
    pricingSettingsUpdatedAt: settingsResult.updatedAt,
    tierVisitPrices: {
      biannual: scopedPrice(biannualPricing, input.includeInterior),
      quarterly: scopedPrice(quarterlyPricing, input.includeInterior),
    },
    tierEnrollmentSavings: {
      biannual: scopedEnrollmentSavings(
        biannualPricing,
        input.includeInterior,
      ),
      quarterly: scopedEnrollmentSavings(
        quarterlyPricing,
        input.includeInterior,
      ),
    },
    exteriorAddOnSelections: input.exteriorAddOns,
  };
}

function createdByLabel(
  source: CreatePresentationAuthorityInput["authoringSource"],
  actor: HqActor,
): string {
  if (source === "care_plan_builder") return "Care Plan Builder";
  if (source === "lead_request") return "HQ Request";
  return actor.email;
}

export async function createAuthorizedPresentation(
  input: CreatePresentationAuthorityInput,
  actor: HqActor,
): Promise<PresentationData> {
  const quoteSnapshot = await buildServerPricingSnapshot(input.pricing);
  const tier = careFrequencyToPresentationTier(input.pricing.frequency);
  const clientName = input.clientName ?? "New Client";
  const authoritySha256 = computePresentationAuthoritySha256({
    clientName,
    clientAddress: "",
    clientEmail: "",
    homeSqft: quoteSnapshot.sqft,
    tier,
    twoStory: quoteSnapshot.twoStory,
    includeScreens: quoteSnapshot.includeScreens,
    quoteSnapshot,
  });
  return createPresentation({
    clientName,
    createdBy: createdByLabel(input.authoringSource, actor),
    tier,
    homeSqft: input.pricing.squareFeet,
    quoteSnapshot,
    authoritySha256,
  });
}

function pricingInputForPatch(
  existing: PresentationData,
  patch: PatchPresentationAuthorityInput,
): PresentationPricingAuthorityInput {
  const prior = existing.quoteSnapshot;
  if (
    prior?.exteriorAddOnQuote.lineItems.length &&
    !isAuthoritativePresentationQuoteSnapshot(prior)
  ) {
    throw new PresentationAuthoringError(
      "Legacy add-on pricing has no verified source inputs; recreate the quote in the Care Plan Builder",
      409,
    );
  }

  const tier = patch.tier ?? existing.tier;
  return {
    squareFeet: patch.homeSqft ?? existing.homeSqft,
    frequency: tier === "quarterly" ? "quarterly" : "bi_annual",
    includeInterior: prior?.includeInterior ?? false,
    twoStory: patch.twoStory ?? existing.twoStory,
    includeScreens: patch.includeScreens ?? existing.includeScreens,
    exteriorAddOns: isAuthoritativePresentationQuoteSnapshot(prior)
      ? prior.exteriorAddOnSelections
      : [],
  };
}

export async function patchAuthorizedPresentation(
  id: string,
  patch: PatchPresentationAuthorityInput,
): Promise<PresentationData | null> {
  const existing = await getPresentation(id);
  if (!existing) return null;
  if (existing.status === "signed") {
    throw new PresentationAuthoringError(
      "Signed presentations are immutable",
      409,
    );
  }

  const quoteSnapshot = await buildServerPricingSnapshot(
    pricingInputForPatch(existing, patch),
  );
  const tier = careFrequencyToPresentationTier(quoteSnapshot.frequency);
  const authoritativeIdentity = {
    clientName: patch.clientName ?? existing.clientName,
    clientAddress: patch.clientAddress ?? existing.clientAddress,
    clientEmail: patch.clientEmail ?? existing.clientEmail,
    homeSqft: quoteSnapshot.sqft,
    tier,
    twoStory: quoteSnapshot.twoStory,
    includeScreens: quoteSnapshot.includeScreens,
    quoteSnapshot,
  };
  return patchPresentation(id, {
    ...patch,
    quoteSnapshot,
    tier,
    homeSqft: quoteSnapshot.sqft,
    twoStory: quoteSnapshot.twoStory,
    includeScreens: quoteSnapshot.includeScreens,
    monthlyRate: 0,
    overrideTier: null,
    visitRateOverrides: {},
    enrollmentSavings:
      quoteSnapshot.tierEnrollmentSavings?.[
        careFrequencyToPresentationTier(quoteSnapshot.frequency)
      ] ?? 0,
    authoritySha256: computePresentationAuthoritySha256(
      authoritativeIdentity,
    ),
  });
}
