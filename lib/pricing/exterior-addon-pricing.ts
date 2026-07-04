import type { CareFrequency } from "./types";
import type {
  CompanySettings,
  ExteriorAddOnSettings,
} from "./company-settings";
import { normalizeCompanySettings } from "./company-settings";
import type {
  ExteriorAddOnId,
  ExteriorAddOnLineItem,
  ExteriorAddOnQuote,
  ExteriorAddOnSelection,
} from "./types";

export const EXTERIOR_ADDON_LABELS: Record<ExteriorAddOnId, string> = {
  soft_wash_exterior: "Soft Wash — Exterior",
  moss_removal: "Moss Removal",
  pressure_wash_concrete: "Pressure Wash — Concrete",
  screen_rescreening: "Screen Rescreening",
};

export function getMemberAddOnDiscountPercent(
  frequency: CareFrequency,
  settings: CompanySettings = normalizeCompanySettings(),
): number {
  const { memberAddOnDiscount } = normalizeCompanySettings(settings).exteriorAddOns;
  return frequency === "quarterly"
    ? memberAddOnDiscount.quarterly
    : memberAddOnDiscount.bi_annual;
}

export function applyMemberAddOnDiscount(
  listAmount: number,
  discountPercent: number | null | undefined,
): number {
  if (listAmount <= 0 || discountPercent == null || discountPercent <= 0) {
    return listAmount;
  }
  return Math.round(listAmount * (1 - discountPercent / 100) * 100) / 100;
}

/** Aggregate member discount on add-on list subtotal for a tier. */
export function applyMemberDiscount(
  subtotal: number,
  tier: "quarterly" | "biannual",
  settings: CompanySettings = normalizeCompanySettings(),
): { discountedTotal: number; savings: number } {
  if (subtotal <= 0) {
    return { discountedTotal: 0, savings: 0 };
  }

  const frequency: CareFrequency =
    tier === "quarterly" ? "quarterly" : "bi_annual";
  const rate = getMemberAddOnDiscountPercent(frequency, settings) / 100;
  const savings = Math.round(subtotal * rate * 100) / 100;

  return {
    discountedTotal: Math.round((subtotal - savings) * 100) / 100,
    savings,
  };
}

export function calculateSoftWashQuote(
  homeSqft: number,
  softWash: ExteriorAddOnSettings["softWash"],
): number {
  if (homeSqft <= softWash.largeHomeSqftThreshold) {
    return Math.min(
      softWash.maxPrice,
      Math.max(softWash.minPrice, softWash.defaultPrice),
    );
  }

  const extraThousands = Math.ceil(
    (homeSqft - softWash.largeHomeSqftThreshold) / 1000,
  );
  return softWash.defaultPrice + extraThousands * softWash.largeHomePer1000Sqft;
}

export function calculateMossRemovalQuote(
  affectedSqft: number,
  moss: ExteriorAddOnSettings["mossRemoval"],
): number {
  if (affectedSqft <= 0) return 0;
  return Math.round(affectedSqft * moss.ratePerSqft);
}

export function calculatePressureWashConcreteQuote(
  concreteSqft: number,
  concrete: ExteriorAddOnSettings["pressureWashConcrete"],
): number {
  if (concreteSqft <= 0) return 0;
  return Math.round(concreteSqft * concrete.ratePerSqft);
}

export function calculateScreenRescreeningQuote(
  screenCount: number,
  pricing: ExteriorAddOnSettings["screenRescreening"],
): { perScreen: number; total: number } {
  if (screenCount <= 0) return { perScreen: 0, total: 0 };

  let perScreen: number;
  if (screenCount >= pricing.bulkMinCount) {
    perScreen = pricing.bulkPricePerScreen;
  } else if (screenCount >= pricing.midTierMinCount) {
    perScreen = pricing.midTierPricePerScreen;
  } else {
    perScreen = pricing.singleScreenPrice;
  }

  return { perScreen, total: perScreen * screenCount };
}

function lineItem(
  id: ExteriorAddOnId,
  listAmount: number,
  detail: string,
  memberDiscountPercent: number | null,
): ExteriorAddOnLineItem {
  const amount = applyMemberAddOnDiscount(listAmount, memberDiscountPercent);
  return {
    id,
    label: EXTERIOR_ADDON_LABELS[id],
    listAmount,
    amount,
    detail,
    memberDiscountPercent: memberDiscountPercent ?? undefined,
  };
}

export interface ExteriorAddOnQuoteOptions {
  /** Quarterly 25% · Bi-Annual 20% — pass null for non-member quotes */
  memberDiscountPercent?: number | null;
}

export function calculateExteriorAddOnQuote(
  homeSqft: number,
  selections: ExteriorAddOnSelection[],
  settings: CompanySettings = normalizeCompanySettings(),
  options?: ExteriorAddOnQuoteOptions,
): ExteriorAddOnQuote {
  const { exteriorAddOns } = normalizeCompanySettings(settings);
  const memberDiscountPercent = options?.memberDiscountPercent ?? null;
  const lineItems: ExteriorAddOnLineItem[] = [];

  for (const selection of selections) {
    if (!selection.enabled) continue;

    switch (selection.id) {
      case "soft_wash_exterior": {
        const listAmount = calculateSoftWashQuote(
          homeSqft,
          exteriorAddOns.softWash,
        );
        lineItems.push(
          lineItem(
            selection.id,
            listAmount,
            homeSqft > exteriorAddOns.softWash.largeHomeSqftThreshold
              ? `${homeSqft.toLocaleString()} sq ft home — large property rate`
              : `Flat rate for homes up to ${exteriorAddOns.softWash.largeHomeSqftThreshold.toLocaleString()} sq ft`,
            memberDiscountPercent,
          ),
        );
        break;
      }
      case "moss_removal": {
        const area = selection.areaSqft ?? 0;
        const listAmount = calculateMossRemovalQuote(
          area,
          exteriorAddOns.mossRemoval,
        );
        if (listAmount > 0) {
          lineItems.push(
            lineItem(
              selection.id,
              listAmount,
              `${area.toLocaleString()} sq ft affected · $${exteriorAddOns.mossRemoval.ratePerSqft}/sq ft`,
              memberDiscountPercent,
            ),
          );
        }
        break;
      }
      case "pressure_wash_concrete": {
        const area = selection.areaSqft ?? 0;
        const listAmount = calculatePressureWashConcreteQuote(
          area,
          exteriorAddOns.pressureWashConcrete,
        );
        if (listAmount > 0) {
          lineItems.push(
            lineItem(
              selection.id,
              listAmount,
              `${area.toLocaleString()} sq ft concrete · $${exteriorAddOns.pressureWashConcrete.ratePerSqft}/sq ft`,
              memberDiscountPercent,
            ),
          );
        }
        break;
      }
      case "screen_rescreening": {
        const count = selection.screenCount ?? 0;
        const { perScreen, total } = calculateScreenRescreeningQuote(
          count,
          exteriorAddOns.screenRescreening,
        );
        if (total > 0) {
          const tierLabel =
            count >= exteriorAddOns.screenRescreening.bulkMinCount
              ? `${count} screens @ $${perScreen} each (6+ tier)`
              : count >= exteriorAddOns.screenRescreening.midTierMinCount
                ? `${count} screens @ $${perScreen} each (3–5 tier)`
                : `${count} screen${count === 1 ? "" : "s"} @ $${perScreen} each`;
          lineItems.push(
            lineItem(selection.id, total, tierLabel, memberDiscountPercent),
          );
        }
        break;
      }
    }
  }

  const listSubtotal = lineItems.reduce((sum, item) => sum + item.listAmount, 0);
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const memberSavings =
    memberDiscountPercent != null && memberDiscountPercent > 0
      ? Math.round(listSubtotal * (memberDiscountPercent / 100) * 100) / 100
      : listSubtotal - subtotal;

  return {
    lineItems,
    subtotal,
    listSubtotal,
    memberDiscountPercent,
    memberSavings,
  };
}

export function defaultExteriorAddOnSelections(): ExteriorAddOnSelection[] {
  return [
    { id: "soft_wash_exterior", enabled: false },
    { id: "moss_removal", enabled: false, areaSqft: 400 },
    { id: "pressure_wash_concrete", enabled: false, areaSqft: 600 },
    { id: "screen_rescreening", enabled: false, screenCount: 4 },
  ];
}
