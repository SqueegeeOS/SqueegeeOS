/** When SqueegeeKing OS launched — first Command Center session */
export const OS_LAUNCHED_KEY = "squeegeeking:business-started";

/** @deprecated Use OS_LAUNCHED_KEY */
export const BUSINESS_STARTED_KEY = OS_LAUNCHED_KEY;

export function ensureOsLaunchedDate(): string {
  if (typeof window === "undefined") {
    return new Date().toISOString().slice(0, 10);
  }

  const existing = localStorage.getItem(OS_LAUNCHED_KEY);
  if (existing) return existing;

  const today = new Date().toISOString().slice(0, 10);
  localStorage.setItem(OS_LAUNCHED_KEY, today);
  return today;
}

export function getOsLaunchedDate(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(OS_LAUNCHED_KEY);
}

export function formatBusinessDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

/** Inclusive day count — day 1 is the start date */
export function getInclusiveDayCount(
  startDate: string,
  referenceDate = new Date(),
): number {
  const start = new Date(`${startDate}T12:00:00`);
  const today = new Date(referenceDate);
  today.setHours(12, 0, 0, 0);
  const diffMs = today.getTime() - start.getTime();
  return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);
}

export function getYearsBuilding(
  companyFoundedDate: string,
  referenceDate = new Date(),
): number {
  const start = new Date(`${companyFoundedDate}T12:00:00`);
  const today = new Date(referenceDate);
  const years = today.getFullYear() - start.getFullYear();
  const monthGap = today.getMonth() - start.getMonth();
  const dayGap = today.getDate() - start.getDate();
  if (monthGap < 0 || (monthGap === 0 && dayGap < 0)) {
    return Math.max(0, years - 1);
  }
  return Math.max(0, years);
}
