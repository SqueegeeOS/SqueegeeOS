import {
  normalizeToSqueegeeKingTier,
  SQUEEGEEKING_TIERS,
  type SqueegeeKingTierId,
} from "@/lib/membership/tier-config";

export interface PresentationIncludedItem {
  label: string;
  detail: string;
}

export interface PresentationDifferenceRow {
  us: string;
  them: string;
}

const SHARED_DIFFERENCE_ROWS: PresentationDifferenceRow[] = [
  {
    us: "Scheduled rhythm — not when you remember",
    them: "Call when it looks bad",
  },
  { us: "Locked member pricing", them: "Price changes every visit" },
  { us: "Property documented over time", them: "No record of your home" },
  { us: "Billed before we arrive", them: "Payment at the door" },
  { us: "7-day workmanship guarantee", them: "Hope it looks fine" },
];

const QUARTERLY_DIFFERENCE_ROW: PresentationDifferenceRow = {
  us: "RainBlock + Hard Water included",
  them: "Treatments sold separately",
};

const BIANNUAL_DIFFERENCE_ROW: PresentationDifferenceRow = {
  us: "20% off add-on services",
  them: "Full price on every extra",
};

/** Visual included slide — tier-specific only. */
export function presentationIncludedItems(
  tier: SqueegeeKingTierId | string,
): PresentationIncludedItem[] {
  const id = normalizeToSqueegeeKingTier(tier);
  const def = SQUEEGEEKING_TIERS[id];

  const items: PresentationIncludedItem[] = [
    {
      label: "Exterior windows",
      detail: `Every visit · ${def.visitsPerYear}× per year`,
    },
    {
      label: "Priority scheduling",
      detail: "Members first",
    },
    {
      label: "Locked member pricing",
      detail: "No surprises",
    },
    {
      label: "Property health",
      detail: "Documented care",
    },
    {
      label: "Add-on savings",
      detail: `${def.addonDiscount}% off add-ons`,
    },
  ];

  if (id === "quarterly") {
    items.splice(1, 0, {
      label: "RainBlock & Hard Water",
      detail: "Included every visit",
    });
  }

  return items;
}

/** Difference slide — tier-specific; never claim Quarterly treatments on Bi-Annual. */
export function presentationDifferenceRows(
  tier: SqueegeeKingTierId | string,
): PresentationDifferenceRow[] {
  const id = normalizeToSqueegeeKingTier(tier);
  const treatmentRow =
    id === "quarterly" ? QUARTERLY_DIFFERENCE_ROW : BIANNUAL_DIFFERENCE_ROW;

  return [
    SHARED_DIFFERENCE_ROWS[0]!,
    SHARED_DIFFERENCE_ROWS[1]!,
    SHARED_DIFFERENCE_ROWS[2]!,
    treatmentRow,
    SHARED_DIFFERENCE_ROWS[3]!,
    SHARED_DIFFERENCE_ROWS[4]!,
  ];
}

export function tierCertaintyCopy(tier: SqueegeeKingTierId | string): string {
  const id = normalizeToSqueegeeKingTier(tier);
  if (id === "quarterly") {
    return "Both memberships protect your home with priority scheduling and automatic add-on discounts. Quarterly adds RainBlock, Hard Water protection, and 25% OFF every add-on.";
  }
  return "Bi-Annual membership protects your home with priority scheduling, locked member pricing, and 20% OFF add-on services while your membership is active.";
}

export function tierIncludesPremiumTreatments(
  tier: SqueegeeKingTierId | string,
): boolean {
  return normalizeToSqueegeeKingTier(tier) === "quarterly";
}
