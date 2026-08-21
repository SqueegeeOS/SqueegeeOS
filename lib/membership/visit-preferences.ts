export const VISIT_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export interface MembershipVisitPreference {
  id: string;
  membershipId: string;
  sequence: number;
  preferredMonth: number | null;
  timingNote: string | null;
  serviceSummary: string | null;
  visitPrice: number | null;
  customerEditableMonth: boolean;
}
export function monthName(month: number | null): string {
  if (month == null || month < 1 || month > 12) return "Not chosen";
  return VISIT_MONTHS[month - 1];
}

export function validatePreferredVisitMonths(
  months: unknown,
  expectedCount: number,
): number[] | null {
  if (!Array.isArray(months) || months.length !== expectedCount) return null;
  const normalized = months.map((month) =>
    typeof month === "number" && Number.isInteger(month) ? month : Number.NaN,
  );
  if (normalized.some((month) => month < 1 || month > 12)) return null;
  if (new Set(normalized).size !== normalized.length) return null;
  return normalized;
}

