import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasUnresolvedFieldIssue } from "./field-closeout-review";
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), client: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/admin/server-auth", () => ({ authorizeAdminRequest: mocks.authorize }));
vi.mock("@/lib/persistence/supabase/client", () => ({ createServiceRoleSupabaseClient: mocks.client }));
import { GET } from "@/app/api/admin/field-records/issues/route";
const request = () => GET(new Request("https://www.squeegeeking.net/api/admin/field-records/issues"));
describe("native technician issue truth", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.authorize.mockReturnValue(true); mocks.client.mockReturnValue({ rpc: mocks.rpc }); });
  it("includes follow-ups and scope exceptions until separately resolved", () => {
    expect(hasUnresolvedFieldIssue(true, "", false)).toBe(true);
    expect(hasUnresolvedFieldIssue(false, "Skipped upper window", false)).toBe(true);
    expect(hasUnresolvedFieldIssue(false, " ", false)).toBe(false);
    expect(hasUnresolvedFieldIssue(true, "Skipped upper window", true)).toBe(false);
  });
  it("blocks non-owners before loading customer details", async () => {
    mocks.authorize.mockReturnValue(false);
    expect((await request()).status).toBe(401);
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("shows an accurate empty queue and a bounded queue with overflow notice", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    expect(await (await request()).json()).toEqual({ issues: [], hasMore: false });
    const row = { assignment_id: "a", field_record_id: "r", client_name: "Test", technician_name: "Tech", visit_date: "2020-01-01", scope_exception: "Exception", secret: "must not pass" };
    mocks.rpc.mockResolvedValue({ data: Array(51).fill(row), error: null });
    const response = await request(); const body = await response.json();
    expect(body.issues).toHaveLength(50); expect(body.hasMore).toBe(true);
    expect(body.issues[0]).toMatchObject({ visitDate: "2020-01-01", clientName: "Test" });
    expect(JSON.stringify(body)).not.toContain("must not pass");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("does not turn a database failure into no issues", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "private" } });
    const response = await request(); expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("private");
  });
});
