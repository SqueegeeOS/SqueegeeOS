import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), record: vi.fn() }));
vi.mock("@/lib/admin/server-auth", () => ({ authorizeAdminRequest: mocks.authorize }));
vi.mock("@/lib/field-operations/technician-owner-time-server", () => ({ recordTechnicianOwnerTime: mocks.record }));
import { POST } from "@/app/api/admin/technicians/[technicianId]/time-adjustments/route";
const context = { params: Promise.resolve({ technicianId: "11111111-1111-4111-8111-111111111111" }) };
const request = (body: object) => new Request("https://example.test/api/admin/technicians/id/time-adjustments", { method: "POST", body: JSON.stringify(body) });
describe("owner adjustment route", () => {
  beforeEach(() => { vi.resetAllMocks(); });
  it("rejects unauthorized writes", async () => { mocks.authorize.mockReturnValue(false); expect((await POST(request({}), context)).status).toBe(401); expect(mocks.record).not.toHaveBeenCalled(); });
  it("forwards only adjustment fields, not spoofed identity", async () => {
    mocks.authorize.mockReturnValue(true); mocks.record.mockResolvedValue({ id: "saved" });
    const response = await POST(request({ workDate: "2026-11-06", durationMinutes: 180, reason: "owner_added_time", note: "Owner request", idempotencyKey: "key", enteredBy: "Someone", startedAt: "made-up" }), context);
    expect(response.status).toBe(201); expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.record.mock.calls[0][0]).not.toHaveProperty("enteredBy"); expect(mocks.record.mock.calls[0][0]).not.toHaveProperty("startedAt");
  });
  it("reports failed writes", async () => { mocks.authorize.mockReturnValue(true); mocks.record.mockRejectedValue(new Error("Conflict")); expect((await POST(request({}), context)).status).toBe(400); });
});
