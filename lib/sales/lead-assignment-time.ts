function localDateTimeValue(value: Date): string {
  const offsetMs = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
}

export const INBOUND_TRIAGE_SLOT_MINUTES = 15;

export function inboundTriageMinutesAhead(
  visibleIndex: number,
  spacingMinutes = INBOUND_TRIAGE_SLOT_MINUTES,
): number {
  const safeIndex =
    Number.isInteger(visibleIndex) && visibleIndex >= 0 ? visibleIndex : 0;
  const safeSpacing =
    Number.isInteger(spacingMinutes) && spacingMinutes >= 5
      ? Math.min(spacingMinutes, 120)
      : INBOUND_TRIAGE_SLOT_MINUTES;
  return (safeIndex + 1) * safeSpacing;
}

export function futureLocalDateTimeValue(
  reference = new Date(),
  minutesAhead = 15,
): string {
  const value = new Date(reference.getTime() + minutesAhead * 60_000);
  value.setSeconds(0, 0);
  return localDateTimeValue(value);
}

export function tomorrowMorningLocalDateTimeValue(
  reference = new Date(),
): string {
  const value = new Date(reference);
  value.setDate(value.getDate() + 1);
  value.setHours(9, 0, 0, 0);
  return localDateTimeValue(value);
}
