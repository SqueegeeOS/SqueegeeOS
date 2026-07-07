import type { MembershipObligationWindow } from "./types";

function parseAnchorDate(startedAt: string): Date | null {
  const parsed = new Date(startedAt);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function toUtcDateOnly(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addUtcMonths(date: Date, months: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()),
  );
}

function subtractUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() - days);
  return next;
}

/**
 * Deterministic visit windows for the first membership year.
 * Quarterly = 4 × ~3 months; Bi-Annual = 2 × ~6 months.
 */
export function buildMembershipObligationWindows(
  visitsPerYear: number,
  startedAt: string,
  membershipYear = 1,
): MembershipObligationWindow[] {
  if (!Number.isInteger(visitsPerYear) || visitsPerYear < 1 || visitsPerYear > 12) {
    return [];
  }

  const anchor = parseAnchorDate(startedAt);
  if (!anchor) return [];

  const monthsPerWindow = 12 / visitsPerYear;
  const windows: MembershipObligationWindow[] = [];

  for (let index = 0; index < visitsPerYear; index += 1) {
    const windowStart = addUtcMonths(anchor, index * monthsPerWindow);
    const nextWindowStart = addUtcMonths(anchor, (index + 1) * monthsPerWindow);
    const windowEnd = subtractUtcDays(nextWindowStart, 1);

    windows.push({
      sequence: index + 1,
      membershipYear,
      targetWindowStart: toUtcDateOnly(windowStart),
      targetWindowEnd: toUtcDateOnly(windowEnd),
    });
  }

  return windows;
}
