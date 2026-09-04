import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), load: vi.fn() }));
vi.mock("@/lib/admin/server-auth", () => ({ authorizeAdminRequest: mocks.authorize }));
vi.mock("@/lib/field-records/technician-history-server", () => ({ loadTechnicianHistory: mocks.load }));
import { GET } from "@/app/api/admin/field-records/history/route";
const request = (query = "month=2026-09") => GET(new Request(`https://www.squeegeeking.net/api/admin/field-records/history?${query}`));
describe("private owner history endpoint", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.authorize.mockReturnValue(true); });
  it("denies non-owners before reading records", async () => {
    mocks.authorize.mockReturnValue(false);
    expect((await request()).status).toBe(401); expect(mocks.load).not.toHaveBeenCalled();
  });
  it.each(["month=2026-13", "month=0000-01", "month=oops", "month=2026-09&cursor=bad"])("rejects invalid filters %s", async query => {
    expect((await request(query)).status).toBe(400); expect(mocks.load).not.toHaveBeenCalled();
  });
  it("returns a truthful empty month with no shared caching", async () => {
    mocks.load.mockResolvedValue({ month: "2026-09", items: [], nextCursor: null });
    const response = await request(); expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ month: "2026-09", items: [], nextCursor: null });
  });
  it("does not leak query errors or claim an empty history on failure", async () => {
    mocks.load.mockRejectedValue(new Error("secret query")); const response = await request();
    expect(response.status).toBe(503); expect(JSON.stringify(await response.json())).not.toContain("secret query");
  });
});
