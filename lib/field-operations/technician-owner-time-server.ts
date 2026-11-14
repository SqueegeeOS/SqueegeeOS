import "server-only";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { isTechnicianProfileId } from "./technician-profile";
export async function recordTechnicianOwnerTime(input: { technicianId: string; workDate: unknown; durationMinutes: unknown; resolvedClockId?: unknown; reason: unknown; note: unknown; idempotencyKey: unknown }) {
  if (!isTechnicianProfileId(input.technicianId)) throw new Error("Choose a valid technician.");
  if (typeof input.workDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.workDate)) throw new Error("Choose a valid work date.");
  if (typeof input.durationMinutes !== "number" || !Number.isInteger(input.durationMinutes) || input.durationMinutes <= 0 || input.durationMinutes > 1080) throw new Error("Enter whole minutes between 1 and 1,080.");
  if (input.resolvedClockId != null && !isTechnicianProfileId(input.resolvedClockId)) throw new Error("Choose a valid clock to resolve.");
  if (input.reason !== "owner_estimate" && input.reason !== "owner_added_time") throw new Error("Choose a valid owner adjustment reason.");
  if (typeof input.note !== "string" || !input.note.trim() || input.note.length > 1000) throw new Error("Explain the owner adjustment in 1–1,000 characters.");
  if (typeof input.idempotencyKey !== "string" || !input.idempotencyKey.trim() || input.idempotencyKey.length > 200) throw new Error("Provide a valid adjustment request identifier.");
  const { data, error } = await createServiceRoleSupabaseClient().rpc("record_homeatlas_owner_time_adjustment", {
    p_technician_id: input.technicianId, p_work_date: input.workDate, p_duration_minutes: input.durationMinutes,
    p_resolved_clock_id: input.resolvedClockId ?? null, p_reason: input.reason, p_note: input.note.trim(),
    p_entered_by: "HomeAtlas HQ", p_idempotency_key: input.idempotencyKey.trim(),
  });
  if (error) throw new Error(error.message ?? "Could not record owner adjustment.");
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Owner adjustment was not returned.");
  return row;
}
