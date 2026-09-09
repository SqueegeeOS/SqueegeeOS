import "server-only";

import {
  COMPANY_BUSINESS_TIMEZONE,
  formatBusinessCalendarDate,
  zonedDateTimeToUtc,
} from "@/lib/admin/company-business-timezone";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { isTechnicianProfileId } from "./technician-profile";

export type TechnicianManualTimeReason =
  | "missed_clock"
  | "pre_atlas"
  | "owner_correction";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLOCK_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const REASONS = new Set<TechnicianManualTimeReason>([
  "missed_clock",
  "pre_atlas",
  "owner_correction",
]);

function parseClock(value: string): { hour: number; minute: number } {
  const [hour, minute] = value.split(":").map(Number);
  return { hour, minute };
}

function validateInput(input: {
  technicianId: string;
  assignmentId?: string | null;
  workDate: string;
  startTime: string;
  endTime: string;
  reason: TechnicianManualTimeReason;
  note?: string | null;
}): string | null {
  if (!isTechnicianProfileId(input.technicianId)) return "Choose a valid technician.";
  if (input.assignmentId && !UUID_PATTERN.test(input.assignmentId)) {
    return "Choose a valid related job.";
  }
  if (!DATE_PATTERN.test(input.workDate)) return "Choose a valid work date.";
  if (!CLOCK_PATTERN.test(input.startTime) || !CLOCK_PATTERN.test(input.endTime)) {
    return "Enter a valid start and end time.";
  }
  if (!REASONS.has(input.reason)) return "Choose why this time is being added.";
  if ((input.note ?? "").trim().length > 1000) return "Keep the time note under 1,000 characters.";
  return null;
}

function overlaps(
  entry: { started_at: string; ended_at: string | null },
  startMs: number,
  endMs: number,
): boolean {
  const entryStart = new Date(entry.started_at).getTime();
  const entryEnd = entry.ended_at ? new Date(entry.ended_at).getTime() : Number.POSITIVE_INFINITY;
  return Number.isFinite(entryStart) && entryStart < endMs && entryEnd > startMs;
}

async function assertNoVerifiedClockOverlap(input: {
  technicianId: string;
  startedAt: Date;
  endedAt: Date;
}): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const assignmentResult = await supabase
    .from("homeatlas_technician_visit_assignments")
    .select("id")
    .eq("technician_id", input.technicianId)
    .limit(5_000);
  if (assignmentResult.error) throw new Error("Could not verify native technician clocks.");
  const assignmentIds = (assignmentResult.data ?? []).map((row) => (row as { id: string }).id);

  const nativeResult = assignmentIds.length
    ? await supabase
        .from("homeatlas_technician_job_clocks")
        .select("started_at, ended_at")
        .in("assignment_id", assignmentIds)
        .lt("started_at", input.endedAt.toISOString())
        .limit(5_000)
    : { data: [], error: null };
  if (nativeResult.error) throw new Error("Could not verify native technician clocks.");

  const legacyResult = await supabase
    .from("technician_job_time_entries")
    .select("started_at, ended_at")
    .eq("started_by_jobber_user_id", `homeatlas:${input.technicianId}`)
    .lt("started_at", input.endedAt.toISOString())
    .limit(5_000);
  if (legacyResult.error) throw new Error("Could not verify technician clock history.");

  const startMs = input.startedAt.getTime();
  const endMs = input.endedAt.getTime();
  const verifiedEntries = [
    ...((nativeResult.data ?? []) as Array<{ started_at: string; ended_at: string | null }>),
    ...((legacyResult.data ?? []) as Array<{ started_at: string; ended_at: string | null }>),
  ];
  if (verifiedEntries.some((entry) => overlaps(entry, startMs, endMs))) {
    throw new Error(
      "This overlaps verified technician clock time. Owner-entered time stays separate so recorded hours cannot double-count.",
    );
  }
}

export async function recordTechnicianManualTime(input: {
  technicianId: string;
  assignmentId?: string | null;
  workDate: string;
  startTime: string;
  endTime: string;
  reason: TechnicianManualTimeReason;
  note?: string | null;
  enteredBy?: string;
}): Promise<{
  id: string;
  startedAt: string;
  endedAt: string;
  minutes: number;
}> {
  const validationError = validateInput(input);
  if (validationError) throw new Error(validationError);

  const startClock = parseClock(input.startTime);
  const endClock = parseClock(input.endTime);
  const startedAt = zonedDateTimeToUtc(
    input.workDate,
    startClock.hour,
    startClock.minute,
    0,
    COMPANY_BUSINESS_TIMEZONE,
  );
  const endedAt = zonedDateTimeToUtc(
    input.workDate,
    endClock.hour,
    endClock.minute,
    0,
    COMPANY_BUSINESS_TIMEZONE,
  );
  const minutes = Math.round((endedAt.getTime() - startedAt.getTime()) / 60_000);
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 18 * 60) {
    throw new Error("End time must be after start time and within an 18-hour work window.");
  }

  const now = new Date();
  if (startedAt.getTime() > now.getTime() + 24 * 60 * 60 * 1000) {
    throw new Error("Owner-entered time cannot be added more than one day in the future.");
  }
  if (startedAt.getTime() < now.getTime() - 366 * 24 * 60 * 60 * 1000) {
    throw new Error("Owner-entered time is limited to the last year.");
  }
  if (formatBusinessCalendarDate(startedAt) !== input.workDate) {
    throw new Error("The entered time does not resolve to that Pacific work date.");
  }

  const supabase = createServiceRoleSupabaseClient();
  const technicianResult = await supabase
    .from("homeatlas_technicians")
    .select("id, status")
    .eq("id", input.technicianId)
    .maybeSingle();
  if (technicianResult.error || !technicianResult.data) {
    throw new Error("Technician could not be verified.");
  }

  if (input.assignmentId) {
    const assignmentResult = await supabase
      .from("homeatlas_technician_visit_assignments")
      .select("id, technician_id")
      .eq("id", input.assignmentId)
      .maybeSingle();
    if (assignmentResult.error || !assignmentResult.data) {
      throw new Error("The related HomeAtlas job is no longer available.");
    }
    if ((assignmentResult.data as { technician_id: string }).technician_id !== input.technicianId) {
      throw new Error("That job belongs to a different technician.");
    }

    const clockResult = await supabase
      .from("homeatlas_technician_job_clocks")
      .select("id")
      .eq("assignment_id", input.assignmentId)
      .limit(1);
    if (clockResult.error) throw new Error("Could not verify the job clock before adding time.");
    if ((clockResult.data ?? []).length > 0) {
      throw new Error("That job already has a technician clock. Keep manual time separate from verified clock evidence.");
    }
  }

  await assertNoVerifiedClockOverlap({ technicianId: input.technicianId, startedAt, endedAt });

  const overlappingResult = await supabase
    .from("homeatlas_technician_manual_time_entries")
    .select("id, started_at, ended_at")
    .eq("technician_id", input.technicianId)
    .lt("started_at", endedAt.toISOString())
    .gt("ended_at", startedAt.toISOString())
    .limit(50);
  if (overlappingResult.error) throw new Error("Could not verify existing owner-entered time.");
  const overlapIds = (overlappingResult.data ?? []).map((row) => (row as { id: string }).id);
  if (overlapIds.length > 0) {
    const voidResult = await supabase
      .from("homeatlas_technician_manual_time_voids")
      .select("time_entry_id")
      .in("time_entry_id", overlapIds);
    if (voidResult.error) throw new Error("Could not verify existing time corrections.");
    const voided = new Set(
      (voidResult.data ?? []).map((row) => (row as { time_entry_id: string }).time_entry_id),
    );
    if (overlapIds.some((id) => !voided.has(id))) {
      throw new Error("This overlaps another active owner-entered time entry.");
    }
  }

  const insertResult = await supabase
    .from("homeatlas_technician_manual_time_entries")
    .insert({
      technician_id: input.technicianId,
      assignment_id: input.assignmentId ?? null,
      work_date: input.workDate,
      started_at: startedAt.toISOString(),
      ended_at: endedAt.toISOString(),
      reason: input.reason,
      note: input.note?.trim() ?? "",
      entered_by: input.enteredBy?.trim() || "HomeAtlas HQ",
    })
    .select("id, started_at, ended_at")
    .single();
  if (insertResult.error || !insertResult.data) {
    throw new Error(insertResult.error?.message ?? "Could not save owner-entered technician time.");
  }

  const row = insertResult.data as { id: string; started_at: string; ended_at: string };
  return { id: row.id, startedAt: row.started_at, endedAt: row.ended_at, minutes };
}

export async function voidTechnicianManualTime(input: {
  technicianId: string;
  timeEntryId: string;
  reason: string;
  voidedBy?: string;
}): Promise<void> {
  if (!isTechnicianProfileId(input.technicianId) || !UUID_PATTERN.test(input.timeEntryId)) {
    throw new Error("Choose a valid technician time entry.");
  }
  const reason = input.reason.trim();
  if (!reason || reason.length > 500) throw new Error("Explain why this time entry is being voided.");

  const supabase = createServiceRoleSupabaseClient();
  const entryResult = await supabase
    .from("homeatlas_technician_manual_time_entries")
    .select("id, technician_id")
    .eq("id", input.timeEntryId)
    .maybeSingle();
  if (entryResult.error || !entryResult.data) throw new Error("Time entry not found.");
  if ((entryResult.data as { technician_id: string }).technician_id !== input.technicianId) {
    throw new Error("That time entry belongs to another technician.");
  }

  const result = await supabase.from("homeatlas_technician_manual_time_voids").insert({
    time_entry_id: input.timeEntryId,
    voided_by: input.voidedBy?.trim() || "HomeAtlas HQ",
    reason,
  });
  if (result.error) {
    if (result.error.code === "23505") return;
    throw new Error(result.error.message);
  }
}
