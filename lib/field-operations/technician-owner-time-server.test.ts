import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/persistence/supabase/client", () => ({ createServiceRoleSupabaseClient: () => mocks }));
import { recordTechnicianOwnerTime } from "./technician-owner-time-server";
const input = { technicianId: "11111111-1111-4111-8111-111111111111", workDate: "2026-11-06", durationMinutes: 180, reason: "owner_added_time", note: "Owner authorized three hours, no clock times supplied.", idempotencyKey: "test-owner-adjustment" };
describe("duration-only owner adjustments", () => {
  beforeEach(() => { mocks.rpc.mockReset(); });
  it("uses an audited duration without inventing clock times or technician identity", async () => {
    mocks.rpc.mockResolvedValue({ data: { id: "saved" }, error: null });
    expect(await recordTechnicianOwnerTime(input)).toEqual({ id: "saved" });
    expect(mocks.rpc).toHaveBeenCalledWith("record_homeatlas_owner_time_adjustment", { p_technician_id: input.technicianId, p_work_date: input.workDate, p_duration_minutes: 180, p_resolved_clock_id: null, p_reason: input.reason, p_note: input.note, p_entered_by: "HomeAtlas HQ", p_idempotency_key: input.idempotencyKey });
  });
  it.each([0, -1, 1.5, 1081, "180", null])("rejects invalid minutes %s", async (durationMinutes) => {
    await expect(recordTechnicianOwnerTime({ ...input, durationMinutes })).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("surfaces database conflicts", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "Idempotency conflict" } });
    await expect(recordTechnicianOwnerTime(input)).rejects.toThrow("Idempotency conflict");
  });
});
