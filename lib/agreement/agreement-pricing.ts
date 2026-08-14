import {
  HARDWATER_RETAIL_VALUE,
  memberYearlyWindowSavings,
  oneTimeRetailPerVisit,
  RAINBLOCK_RETAIL_VALUE,
  SQUEEGEEKING_TIERS,
  calculateVisitPrice,
  type SqueegeeKingTierId,
} from "@/lib/membership/tier-config";
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

export interface StandardAgreementPricing extends AgreementPricingSnapshotBase {
  kind: "savings";
  retailRows: AgreementMathRow[];
}

/** @deprecated Use StandardAgreementPricing. */
export type BiannualAgreementPricing = StandardAgreementPricing;

export type AgreementPricingSnapshot =
  | QuarterlyAgreementPricing
  | StandardAgreementPricing;

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
  const visitsPerYear = SQUEEGEEKING_TIERS[input.tier].visitsPerYear;

  // A presentation or quote snapshot supplies the final, customer-facing
  // visit total. Never re-apply interior/screens to a locked price here.
  const membershipPerVisit =
    input.visitPrice && input.visitPrice > 0
      ? input.visitPrice
      : ctx.snapshotVisitPrice && ctx.snapshotTier === input.tier
        ? ctx.snapshotVisitPrice
        : calculateVisitPrice(input.tier, ctx.sqft, {
            twoStory: ctx.twoStory,
            includeScreens: ctx.includeScreens,
            includeInterior: ctx.includeInterior,
          });

  const membershipAnnual = membershipPerVisit * visitsPerYear;
  const retailPerVisit = oneTimeRetailPerVisit(membershipPerVisit, input.tier);
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

  const youSave = memberYearlyWindowSavings(membershipPerVisit, input.tier);
  const visitLabel =
    visitsPerYear === 1 ? "1 One-Time Visit" : `${visitsPerYear} One-Time Visits`;

  return {
    kind: "savings",
    tier: input.tier,
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
