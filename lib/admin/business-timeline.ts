/** Set once on first Command Center visit — marks when SqueegeeKing began using the system */
export const BUSINESS_STARTED_KEY = "squeegeeking:business-started";

export function ensureBusinessStartedDate(): string {
  if (typeof window === "undefined") {
    return new Date().toISOString().slice(0, 10);
  }

  const existing = localStorage.getItem(BUSINESS_STARTED_KEY);
  if (existing) return existing;

  const today = new Date().toISOString().slice(0, 10);
  localStorage.setItem(BUSINESS_STARTED_KEY, today);
  return today;
}

export function formatBusinessStartedDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

/** Inclusive day count — day 1 is the start date */
export function getDaysBuilding(startDate: string, referenceDate = new Date()): number {
  const start = new Date(`${startDate}T12:00:00`);
  const today = new Date(referenceDate);
  today.setHours(12, 0, 0, 0);
  const diffMs = today.getTime() - start.getTime();
  return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);
}
