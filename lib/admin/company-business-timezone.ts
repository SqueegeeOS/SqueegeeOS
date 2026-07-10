/** HQ and membership metrics use the company calendar — Pacific Time, DST-aware. */
export const COMPANY_BUSINESS_TIMEZONE = "America/Los_Angeles";

const CALENDAR_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: COMPANY_BUSINESS_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });
}

/** YYYY-MM-DD for the instant in the company timezone. */
export function formatBusinessCalendarDate(
  instant: Date,
  timeZone: string = COMPANY_BUSINESS_TIMEZONE,
): string {
  if (timeZone === COMPANY_BUSINESS_TIMEZONE) {
    return CALENDAR_FORMATTER.format(instant);
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

function readPart(parts: Intl.DateTimeFormatPart[], type: string): number {
  const value = parts.find((part) => part.type === type)?.value;
  return Number(value ?? 0);
}

/** Offset in minutes: local wall time minus UTC at `utcMs`. */
function getTimeZoneOffsetMinutesAtUtc(
  utcMs: number,
  timeZone: string,
): number {
  const parts = partsFormatter(timeZone).formatToParts(new Date(utcMs));
  const asUtc = Date.UTC(
    readPart(parts, "year"),
    readPart(parts, "month") - 1,
    readPart(parts, "day"),
    readPart(parts, "hour"),
    readPart(parts, "minute"),
    readPart(parts, "second"),
  );
  return (asUtc - utcMs) / 60_000;
}

/** UTC instant for a wall-clock time on a calendar day in the company timezone. */
export function zonedDateTimeToUtc(
  calendarDate: string,
  hour: number,
  minute: number,
  second: number,
  timeZone: string = COMPANY_BUSINESS_TIMEZONE,
): Date {
  const [year, month, day] = calendarDate.split("-").map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  let offsetMinutes = getTimeZoneOffsetMinutesAtUtc(utcGuess, timeZone);
  let utcMs = utcGuess - offsetMinutes * 60_000;
  const refinedOffset = getTimeZoneOffsetMinutesAtUtc(utcMs, timeZone);
  if (refinedOffset !== offsetMinutes) {
    offsetMinutes = refinedOffset;
    utcMs = utcGuess - offsetMinutes * 60_000;
  }
  return new Date(utcMs);
}

function addCalendarDays(calendarDate: string, days: number): string {
  const [year, month, day] = calendarDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

/** Inclusive start and exclusive end (UTC) for the company calendar day of `reference`. */
export function getBusinessCalendarDayUtcBounds(
  reference: Date = new Date(),
  timeZone: string = COMPANY_BUSINESS_TIMEZONE,
): { startUtc: Date; endUtc: Date } {
  const calendarDate = formatBusinessCalendarDate(reference, timeZone);
  const startUtc = zonedDateTimeToUtc(calendarDate, 0, 0, 0, timeZone);
  const endUtc = zonedDateTimeToUtc(
    addCalendarDays(calendarDate, 1),
    0,
    0,
    0,
    timeZone,
  );
  return { startUtc, endUtc };
}

export function isInstantOnBusinessCalendarDay(
  instant: string | Date,
  reference: Date = new Date(),
  timeZone: string = COMPANY_BUSINESS_TIMEZONE,
): boolean {
  const when = typeof instant === "string" ? new Date(instant) : instant;
  if (Number.isNaN(when.getTime())) {
    return false;
  }
  const { startUtc, endUtc } = getBusinessCalendarDayUtcBounds(reference, timeZone);
  return when >= startUtc && when < endUtc;
}

/** Today's date as YYYY-MM-DD in the company timezone (HQ form defaults). */
export function businessTodayIsoDate(reference: Date = new Date()): string {
  return formatBusinessCalendarDate(reference);
}
