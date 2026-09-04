import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("@/lib/persistence/supabase/client", () => ({ createServiceRoleSupabaseClient: mocks.client }));
import { loadHomeAtlasFieldExecution } from "./homeatlas-field-assignment-server";
let resolved: boolean;
let unavailable: boolean;
const closeout = { assignment_id: "assignment", field_record_id: "record", technician_display_name: "Test tech",
  customer_summary: "Original summary", internal_note: "Original note", follow_up_needed: false,
  scope_exception: "Unreachable window", created_at: "2026-09-04T20:00:00Z" };
describe("native execution reflects separate owner resolutions", () => {
  beforeEach(() => {
    resolved = false; unavailable = false;
    mocks.client.mockReturnValue({ from: (table: string) => ({ select: () => ({ in: async () => {
      if (table === "homeatlas_technician_issue_resolutions") return { data: resolved ? [{ field_record_id: "record" }] : [], error: unavailable ? { message: "Private failure" } : null };
      return { data: table === "homeatlas_technician_job_closeouts" ? [closeout] : [], error: null };
    } }) }) });
  });
  it("counts a service exception even without the extra follow-up checkbox", async () => {
    expect((await loadHomeAtlasFieldExecution(["assignment"])).byAssignmentId.get("assignment")?.openFollowUpCount).toBe(1);
  });
  it("clears only the open count while retaining original scope and private notes", async () => {
    resolved = true;
    expect((await loadHomeAtlasFieldExecution(["assignment"])).byAssignmentId.get("assignment")).toMatchObject({
      openFollowUpCount: 0, scopeException: "Unreachable window", internalNote: "Original note", fieldRecordCount: 1, customerVisibleRecordCount: 0,
    });
  });
  it("does not invent resolution status after a failed lookup", async () => {
    unavailable = true;
    await expect(loadHomeAtlasFieldExecution(["assignment"])).rejects.toThrow("Could not verify technician issue status");
  });
});
