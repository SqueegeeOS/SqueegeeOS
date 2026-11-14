/** Owner durations are separate evidence, never synthetic technician clock-outs. */
export interface OwnerTimeAdjustmentRow {
  id: string;
  technician_id: string;
  work_date: string;
  duration_minutes: number;
  resolved_clock_id: string | null;
  reason: "owner_estimate" | "owner_added_time";
  note: string;
  entered_by: string;
  entered_at: string;
}

/** For overlap validation only. Do not display this as an actual clock-out. */
export function ownerResolvedOverlapEnd(
  clock: { id?: string; started_at: string; ended_at: string | null },
  adjustments: Pick<OwnerTimeAdjustmentRow, "resolved_clock_id" | "duration_minutes">[],
): string | null {
  if (clock.ended_at) return clock.ended_at;
  const resolution = adjustments.find((row) => row.resolved_clock_id === clock.id);
  if (!resolution || !clock.id) return null;
  return new Date(Date.parse(clock.started_at) + resolution.duration_minutes * 60_000).toISOString();
}
