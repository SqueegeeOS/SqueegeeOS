/** Customer reminder choices do not grant contact or marketing consent. */
export const DEFAULT_REMINDER_OFFSETS = [1440];
export const MAX_REMINDER_OFFSET_MINUTES = 30 * 24 * 60;
export const REMINDER_CATCHUP_MINUTES = 1440;
export function parseReminderOffsets(value: unknown): number[] {
  if (!Array.isArray(value) || value.length > 4 || value.some((n) => !Number.isInteger(n) || n < 60 || n > MAX_REMINDER_OFFSET_MINUTES)) {
    throw new Error("Choose up to four reminders, between 1 hour and 30 days before the visit.");
  }
  return [...new Set(value as number[])].sort((a, b) => b - a);
}

export function reminderIsDue(input: { dueAt: string | null; scheduledAt: string; now: Date; preferencesUpdatedAt?: string; offsetMinutes?: number }): boolean {
  if (!input.dueAt) return false;
  const due = Date.parse(input.dueAt);
  const scheduled = Date.parse(input.scheduledAt);
  const now = input.now.getTime();
  return Number.isFinite(due) && Number.isFinite(scheduled) && due < scheduled && now < scheduled && now >= due && now - due <= Math.min(input.offsetMinutes ?? 1440, REMINDER_CATCHUP_MINUTES) * 60_000 && (!input.preferencesUpdatedAt || Date.parse(input.preferencesUpdatedAt) <= due);
}
