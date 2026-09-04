import { beforeEach, describe, expect, it, vi } from "vitest";
import { historyNextAction, parseHistoryCursor, type TechnicianHistoryItem } from "./technician-history";
const mocks = vi.hoisted(() => ({ client: vi.fn(), execution: vi.fn(), calls: [] as unknown[][], tables: {} as Record<string, { data: unknown; error: unknown }> }));
vi.mock("@/lib/persistence/supabase/client", () => ({ createServiceRoleSupabaseClient: mocks.client }));
vi.mock("@/lib/field-operations/homeatlas-field-assignment-server", () => ({ loadHomeAtlasFieldExecution: mocks.execution }));
import { loadTechnicianHistory } from "./technician-history-server";

const id = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`;
const stamp = "2026-09-04T15:00:00.123456+00:00";
const record = { clock: { state: "finished", startedAt: stamp, endedAt: "2026-09-04T16:00:00Z", durationSeconds: 3599, startedByDisplayName: "Tech", finishedByDisplayName: "Tech" }, fieldRecordCount: 1, latestFieldRecordBy: "Tech", openFollowUpCount: 0, photoCount: 2, internalNote: "private note not part of list", customerSummary: "private summary" };
function setup(count = 1) {
  mocks.tables = {
    homeatlas_technician_job_clocks: { data: Array.from({ length: count }, (_, i) => ({ id: id(i + 1), assignment_id: id(i + 1), started_at: stamp })), error: null },
    homeatlas_technician_visit_assignments: { data: Array.from({ length: count }, (_, i) => ({ id: id(i + 1), projection_id: id(900), technician_display_name: "Tech" })), error: null },
    jobber_visit_projections: { data: [{ id: id(900), client_name: "Test household", title: "Glass", is_complete: false, visit_status: "REMOVED", visit_invoice_status: "paid", source_observed_at: stamp, raw_payload: "secret" }], error: null },
  };
  mocks.execution.mockResolvedValue({ available: true, byAssignmentId: new Map(Array.from({ length: count }, (_, i) => [id(i + 1), record])) });
}
describe("owner technician history durable reads", () => {
  beforeEach(() => {
    vi.resetAllMocks(); mocks.calls = []; setup();
    mocks.client.mockReturnValue({ from: (table: string) => {
      mocks.calls.push(["from", table]);
      const builder: Record<string, unknown> = { then: (resolve: (value: unknown) => void) => Promise.resolve(mocks.tables[table]).then(resolve) };
      for (const method of ["select", "gte", "lt", "order", "limit", "or", "in"]) builder[method] = (...args: unknown[]) => { mocks.calls.push([table, method, ...args]); return builder; };
      return builder;
    } });
  });
  it("keeps past/removed visits, separates clock-out from Jobber completion, and strips private list data", async () => {
    const result = await loadTechnicianHistory("2026-09", null);
    expect(result.items[0]).toMatchObject({ hasCloseout: true, photoCount: 2, jobberComplete: false, jobberStatus: "REMOVED", invoiceStatus: "paid" });
    expect(historyNextAction(result.items[0])).toBe("Review completion in Jobber");
    expect(JSON.stringify(result)).not.toMatch(/private note|private summary|raw_payload|secret/);
    expect(mocks.calls).toContainEqual(["homeatlas_technician_job_clocks", "gte", "started_at", "2026-09-01T07:00:00.000Z"]);
    expect(mocks.calls).toContainEqual(["homeatlas_technician_job_clocks", "lt", "started_at", "2026-10-01T07:00:00.000Z"]);
  });
  it("uses Pacific month boundaries across daylight saving", async () => {
    await loadTechnicianHistory("2026-03", null);
    expect(mocks.calls).toContainEqual(["homeatlas_technician_job_clocks", "gte", "started_at", "2026-03-01T08:00:00.000Z"]);
    expect(mocks.calls).toContainEqual(["homeatlas_technician_job_clocks", "lt", "started_at", "2026-04-01T07:00:00.000Z"]);
  });
  it("pages by stable timestamp and id without truncating database microseconds", async () => {
    setup(26);
    const result = await loadTechnicianHistory("2026-09", null);
    expect(result.items).toHaveLength(25);
    expect(result.nextCursor).toBe(`${stamp}|${id(25)}`);
    await loadTechnicianHistory("2026-09", result.nextCursor);
    expect(mocks.calls).toContainEqual(["homeatlas_technician_job_clocks", "or", `started_at.lt.${stamp},and(started_at.eq.${stamp},id.lt.${id(25)})`]);
    expect(mocks.calls).toContainEqual(["homeatlas_technician_job_clocks", "order", "id", { ascending: false }]);
  });
  it("does not run detail reads for an empty month", async () => {
    setup(0); expect(await loadTechnicianHistory("2026-09", null)).toEqual({ month: "2026-09", items: [], nextCursor: null });
    expect(mocks.execution).not.toHaveBeenCalled();
  });
  it.each(["homeatlas_technician_job_clocks", "homeatlas_technician_visit_assignments", "jobber_visit_projections"])("fails explicitly when %s cannot be read", async table => {
    mocks.tables[table] = { data: null, error: { message: "private" } };
    await expect(loadTechnicianHistory("2026-09", null)).rejects.toThrow();
  });
  it("does not present unavailable execution as an empty or complete history", async () => {
    mocks.execution.mockResolvedValue({ available: false, byAssignmentId: new Map() });
    await expect(loadTechnicianHistory("2026-09", null)).rejects.toThrow();
  });
  it("preserves time/evidence when the source projection is unavailable", async () => {
    mocks.tables.jobber_visit_projections.data = [];
    const item = (await loadTechnicianHistory("2026-09", null)).items[0];
    expect(item).toMatchObject({ clientName: "Source customer unavailable", jobberComplete: null, invoiceStatus: null, hasCloseout: true });
    expect(historyNextAction(item)).toBe("Jobber status unavailable");
  });
  it("does not silently drop a clock with missing assignment details", async () => {
    mocks.tables.homeatlas_technician_visit_assignments.data = [];
    await expect(loadTechnicianHistory("2026-09", null)).rejects.toThrow("Incomplete history snapshot");
  });
});
describe("history action and cursor invariants", () => {
  const item = { clock: { state: "finished" }, hasCloseout: true, openFollowUp: false, jobberComplete: true } as TechnicianHistoryItem;
  it("distinguishes missing work, running time, and open owner issues", () => {
    expect(historyNextAction({ ...item, clock: { ...item.clock, state: "running" } })).toBe("Still clocked in");
    expect(historyNextAction({ ...item, hasCloseout: false })).toBe("Closeout missing");
    expect(historyNextAction({ ...item, openFollowUp: true })).toBe("Owner follow-up needed");
    expect(historyNextAction(item)).toBe("Work record saved");
  });
  it.each(["garbage", `${stamp}|bad`, `x),id.neq.a|${id(1)}`, `${stamp}|${id(1)}|extra`])("rejects unsafe cursor %s", value => {
    expect(() => parseHistoryCursor(value)).toThrow();
  });
});
