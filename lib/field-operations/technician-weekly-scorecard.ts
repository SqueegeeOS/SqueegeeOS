import type { TechnicianWeeklyScorecard } from "./technician-profile";

interface DatedClock { assignment_id?: string; started_at: string; ended_at: string | null }
interface DatedManual { assignment_id: string | null; work_date: string; started_at: string; ended_at: string }
interface DatedCloseout { assignment_id: string; visit_date: string }
interface DatedAddon { reported_at: string; reported_amount_cents: number; voided_at: string | null }

function minutes(start: string, end: string | null): number {
  if (!end) return 0;
  const difference = Date.parse(end) - Date.parse(start);
  return Number.isFinite(difference) && difference > 0 ? Math.round(difference / 60_000) : 0;
}

export function technicianWeeklyScorecard(input: {
  weekStart: string;
  weekEndExclusive: string;
  weekStartUtc: string;
  weekEndUtc: string;
  closeouts: DatedCloseout[];
  nativeClocks: DatedClock[];
  legacyClocks: DatedClock[];
  manualEntries: DatedManual[];
  addons: DatedAddon[];
}): TechnicianWeeklyScorecard {
  const weekStartMs = Date.parse(input.weekStartUtc);
  const weekEndMs = Date.parse(input.weekEndUtc);
  const inWeekInstant = (value: string) => {
    const time = Date.parse(value);
    return Number.isFinite(time) && time >= weekStartMs && time < weekEndMs;
  };
  const inWeekDate = (value: string) => value >= input.weekStart && value < input.weekEndExclusive;
  const closeouts = input.closeouts.filter((row) => inWeekDate(row.visit_date));
  const native = input.nativeClocks.filter((row) => inWeekInstant(row.started_at));
  const legacy = input.legacyClocks.filter((row) => inWeekInstant(row.started_at));
  const manual = input.manualEntries.filter((row) => inWeekDate(row.work_date));
  const addOns = input.addons.filter((row) => !row.voided_at && inWeekInstant(row.reported_at));
  const assignmentsWithTime = new Set([
    ...input.nativeClocks.filter((row) => minutes(row.started_at, row.ended_at) > 0).flatMap((row) => row.assignment_id ? [row.assignment_id] : []),
    ...manual.flatMap((row) => row.assignment_id ? [row.assignment_id] : []),
  ]);
  return {
    weekStart: input.weekStart,
    completedJobs: closeouts.length,
    clockedMinutes: [...native, ...legacy].reduce((sum, row) => sum + minutes(row.started_at, row.ended_at), 0),
    manualMinutes: manual.reduce((sum, row) => sum + minutes(row.started_at, row.ended_at), 0),
    missingTimeJobs: closeouts.filter((row) => !assignmentsWithTime.has(row.assignment_id)).length,
    reportedAddonCount: addOns.length,
    reportedAddonAmountCents: addOns.reduce((sum, row) => sum + row.reported_amount_cents, 0),
  };
}
