import {
  HARDWATER_RETAIL_VALUE,
  RAINBLOCK_RETAIL_VALUE,
  SQUEEGEEKING_TIERS,
  type SqueegeeKingTierId,
} from "@/lib/membership/tier-config";
import { calculateWindowCarePricing } from "@/lib/pricing/window-care-pricing";
import type { PresentationQuoteSnapshot } from "@/lib/presentations/quote-snapshot";
import { careFrequencyToPresentationTier } from "@/lib/presentations/quote-snapshot";

export interface IncludedTreatmentLine {
  id: string;
  name: string;
  retailPerVisit: number;
  visitsPerYear: number;
  annualValue: number;
}

export interface AgreementMathRow {
  label: string;
  detail: string;
  amount: number;
}

export interface AgreementPricingSnapshotBase {
  tier: SqueegeeKingTierId;
  visitsPerYear: number;
  membershipPerVisit: number;
  membershipAnnual: number;
  retailPerVisit: number;
  retailAnnual: number;
  youSave: number;
  membershipRow: AgreementMathRow;
  source: "quote_snapshot" | "pricing_engine";
}

export interface QuarterlyAgreementPricing extends AgreementPricingSnapshotBase {
  kind: "included";
  includedTreatments: IncludedTreatmentLine[];
  includedAnnualValue: number;
  includedRows: AgreementMathRow[];
}

export interface BiannualAgreementPricing extends AgreementPricingSnapshotBase {
  kind: "savings";
  retailRows: AgreementMathRow[];
}

export type AgreementPricingSnapshot =
  | QuarterlyAgreementPricing
  | BiannualAgreementPricing;

/** Included treatments — retail rates from tier catalog (pricing law) */
export const QUARTERLY_INCLUDED_TREATMENT_DEFINITIONS = [
  {
    id: "rainblock",
    name: "RainBlock Technology",
    retailPerVisit: RAINBLOCK_RETAIL_VALUE,
  },
  {
    id: "hardwater",
    name: "Hard Water Treatment",
    retailPerVisit: HARDWATER_RETAIL_VALUE,
  },
] as const;

export function includedTreatmentsForTier(
  tier: SqueegeeKingTierId,
): IncludedTreatmentLine[] {
  if (tier !== "quarterly") return [];

  const visitsPerYear = SQUEEGEEKING_TIERS.quarterly.visitsPerYear;
  return QUARTERLY_INCLUDED_TREATMENT_DEFINITIONS.map((treatment) => ({
    id: treatment.id,
    name: treatment.name,
    retailPerVisit: treatment.retailPerVisit,
    visitsPerYear,
    annualValue: treatment.retailPerVisit * visitsPerYear,
  }));
}

export function formatAgreementDollars(amount: number): string {
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

function buildMathRow(
  label: string,
  perUnit: number,
  count: number,
): AgreementMathRow {
  const amount = perUnit * count;
  return {
    label,
    detail: `${formatAgreementDollars(perUnit)} × ${count} = ${formatAgreementDollars(amount)}`,
    amount,
  };
}

export interface BuildAgreementPricingInput {
  tier: SqueegeeKingTierId;
  /** Locked per-visit price from presentation / sign step */
  visitPrice?: number;
  quoteSnapshot?: PresentationQuoteSnapshot | null;
  homeSqft?: number;
  twoStory?: boolean;
  includeScreens?: boolean;
  includeInterior?: boolean;
}

function resolvePricingContext(input: BuildAgreementPricingInput) {
  if (input.quoteSnapshot) {
    return {
      sqft: input.quoteSnapshot.sqft,
      twoStory: input.quoteSnapshot.twoStory,
      includeScreens: input.quoteSnapshot.includeScreens,
      includeInterior: input.quoteSnapshot.includeInterior,
      source: "quote_snapshot" as const,
      snapshotTier: careFrequencyToPresentationTier(input.quoteSnapshot.frequency),
      snapshotVisitPrice: input.quoteSnapshot.windowCareVisitPrice,
    };
  }

  return {
    sqft: input.homeSqft ?? 2500,
    twoStory: input.twoStory ?? false,
    includeScreens: input.includeScreens ?? false,
    includeInterior: input.includeInterior ?? false,
    source: "pricing_engine" as const,
    snapshotTier: undefined,
    snapshotVisitPrice: undefined,
  };
}

/**
 * Single pricing truth for agreements — always flows from Atlas Pricing Engine
 * (+ optional quote_snapshot lock from presentation).
 */
export function buildAgreementPricingSnapshot(
  input: BuildAgreementPricingInput,
): AgreementPricingSnapshot {
  const ctx = resolvePricingContext(input);
  const frequency = input.tier === "quarterly" ? "quarterly" : "bi_annual";

  const pricing = calculateWindowCarePricing({
    squareFeet: ctx.sqft,
    frequency,
    includeInterior: ctx.includeInterior,
    twoStory: ctx.twoStory,
    includeScreens: ctx.includeScreens,
  });

  const visitsPerYear = pricing.annualVisits;
  const retailPerVisit = ctx.includeInterior
    ? pricing.interiorExteriorOneTimePrice
    : pricing.exteriorOneTimePrice;
  const engineMembershipPerVisit = ctx.includeInterior
    ? pricing.interiorExteriorMemberPrice
    : pricing.exteriorMemberPrice;

  const membershipPerVisit =
    input.visitPrice && input.visitPrice > 0
      ? input.visitPrice
      : ctx.snapshotVisitPrice && ctx.snapshotTier === input.tier
        ? ctx.snapshotVisitPrice
        : engineMembershipPerVisit;

  const membershipAnnual = membershipPerVisit * visitsPerYear;
  const windowRetailAnnual = retailPerVisit * visitsPerYear;
  const membershipRow = buildMathRow("Membership", membershipPerVisit, visitsPerYear);

  if (input.tier === "quarterly") {
    const includedTreatments = includedTreatmentsForTier("quarterly");
    const includedAnnualValue = includedTreatments.reduce(
      (sum, line) => sum + line.annualValue,
      0,
    );
    const includedRows = includedTreatments.map((treatment) =>
      buildMathRow(treatment.name, treatment.retailPerVisit, treatment.visitsPerYear),
    );

    return {
      kind: "included",
      tier: "quarterly",
      visitsPerYear,
      membershipPerVisit,
      membershipAnnual,
      retailPerVisit,
      retailAnnual: membershipAnnual + includedAnnualValue,
      youSave: includedAnnualValue,
      membershipRow,
      includedTreatments,
      includedAnnualValue,
      includedRows,
      source: ctx.source,
    };
  }

  const youSave = Math.max(0, windowRetailAnnual - membershipAnnual);
  const visitLabel =
    visitsPerYear === 1 ? "1 One-Time Visit" : `${visitsPerYear} One-Time Visits`;

  return {
    kind: "savings",
    tier: "biannual",
    visitsPerYear,
    membershipPerVisit,
    membershipAnnual,
    retailPerVisit,
    retailAnnual: windowRetailAnnual,
    youSave,
    membershipRow,
    retailRows: [buildMathRow(visitLabel, retailPerVisit, visitsPerYear)],
    source: ctx.source,
  };
}

/** @deprecated Use buildAgreementPricingSnapshot */
export function summarizeAgreementValue(
  input: BuildAgreementPricingInput,
): AgreementPricingSnapshot {
  return buildAgreementPricingSnapshot(input);
}
