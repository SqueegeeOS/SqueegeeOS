export const SALES_SERVICE_INTERESTS = [
  "exterior_windows",
  "interior_windows",
  "screens",
  "cobweb_removal",
  "solar_panels",
  "pressure_washing",
  "gutter_cleaning",
  "home_care_membership",
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
    id: "solar_panels",
    label: "Solar panels",
    shortLabel: "Solar",
    detail: "Quote the exact panel visit sequence",
  },
  {
    id: "pressure_washing",
    label: "Pressure washing",
    shortLabel: "Pressure wash",
    detail: "Quote the surface and timing separately",
  },
  {
    id: "gutter_cleaning",
    label: "Gutter cleaning",
    shortLabel: "Gutters",
    detail: "Keep the request visible until scoped",
  },
  {
    id: "home_care_membership",
    label: "Home care membership",
    shortLabel: "Membership",
    detail: "Recurring care interest; confirm exact scope",
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

const LEAD_INTAKE_SERVICE_INTERESTS: Readonly<
  Record<string, readonly SalesServiceInterest[]>
> = {
  "Window Cleaning": ["exterior_windows"],
  "Gutter Cleaning": ["gutter_cleaning"],
  "Pressure Washing": ["pressure_washing"],
  "Solar Panel Cleaning": ["solar_panels"],
  "Exterior Home Care": ["home_care_membership"],
  "Full Home Care Membership": ["home_care_membership"],
};

/**
 * Converts the public request / Meta lead vocabulary into the private field
 * sales vocabulary. Unknown historical labels stay visible as `other` rather
 * than silently disappearing. None of these values are contractual scope.
 */
export function salesServiceInterestsFromLeadIntake(
  value: unknown,
): SalesServiceInterest[] {
  if (!Array.isArray(value)) return normalizeSalesServiceInterests(undefined);

  const mapped = value.flatMap((candidate): readonly SalesServiceInterest[] => {
    if (typeof candidate !== "string") return [];
    return LEAD_INTAKE_SERVICE_INTERESTS[candidate.trim()] ?? ["other"];
  });
  return normalizeSalesServiceInterests(mapped);
}
