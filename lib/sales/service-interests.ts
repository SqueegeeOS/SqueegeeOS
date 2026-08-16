export const SALES_SERVICE_INTERESTS = [
  "exterior_windows",
  "interior_windows",
  "screens",
  "cobweb_removal",
  "other",
] as const;

export type SalesServiceInterest =
  (typeof SALES_SERVICE_INTERESTS)[number];

export const SALES_SERVICE_INTEREST_OPTIONS: ReadonlyArray<{
  id: SalesServiceInterest;
  label: string;
  shortLabel: string;
  detail: string;
}> = [
  {
    id: "exterior_windows",
    label: "Exterior windows",
    shortLabel: "Exterior",
    detail: "The core HomeAtlas visit",
  },
  {
    id: "interior_windows",
    label: "Interior windows",
    shortLabel: "Interior",
    detail: "Always, yearly, or by request",
  },
  {
    id: "screens",
    label: "Screens",
    shortLabel: "Screens",
    detail: "Include or offer as an add-on",
  },
  {
    id: "cobweb_removal",
    label: "Cobweb removal",
    shortLabel: "Cobwebs",
    detail: "Recurring or optional exterior care",
  },
  {
    id: "other",
    label: "Another service",
    shortLabel: "Other",
    detail: "Name it in the doorstep notes",
  },
];

const SALES_SERVICE_INTEREST_SET = new Set<string>(SALES_SERVICE_INTERESTS);

export function isSalesServiceInterest(
  value: unknown,
): value is SalesServiceInterest {
  return typeof value === "string" && SALES_SERVICE_INTEREST_SET.has(value);
}
/**
 * One stable, duplicate-free ordering for database rows, mobile drafts, retry
 * fingerprints, and UI. Exterior window care remains the core service.
 */
export function normalizeSalesServiceInterests(
  value: unknown,
): SalesServiceInterest[] {
  const requested = new Set<SalesServiceInterest>(["exterior_windows"]);
  if (Array.isArray(value)) {
    for (const candidate of value) {
      if (isSalesServiceInterest(candidate)) requested.add(candidate);
    }
  }
  return SALES_SERVICE_INTERESTS.filter((interest) => requested.has(interest));
}

export function salesServiceInterestLabel(
  interest: SalesServiceInterest,
): string {
  return (
    SALES_SERVICE_INTEREST_OPTIONS.find((option) => option.id === interest)
      ?.shortLabel ?? interest
  );
}
