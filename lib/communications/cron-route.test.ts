import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ process: vi.fn() }));
vi.mock("@/lib/communications/reminders", () => ({ processVerifiedAppointmentReminders: mocks.process }));
import { GET } from "@/app/api/cron/communications/route";
const request = (auth = "Bearer synthetic-secret") => new Request("https://example.test/api/cron/communications", { headers: { authorization: auth } });
beforeEach(() => {
  vi.resetAllMocks();
  process.env.CRON_SECRET = "synthetic-secret";
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
describe("communications cron visibility", () => {
  it.each(["", "Bearer wrong"])("rejects invalid authorization without processing or a success log", async (auth) => {
    expect((await GET(request(auth))).status).toBe(401);
    expect(mocks.process).not.toHaveBeenCalled();
    expect(console.info).not.toHaveBeenCalled();
  });
  it("logs only aggregate counters after a successful routine run", async () => {
    const reminders = { candidates: 4, sent: 0, duplicate: 1, skipped: 3, failed: 0 };
    mocks.process.mockResolvedValue(reminders);
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, reminders });
    expect(console.info).toHaveBeenCalledExactlyOnceWith("[communications-cron] completed", { reminders });
  });
  it("does not log success when processing fails", async () => {
    mocks.process.mockRejectedValue(new Error("synthetic_failure"));
    expect((await GET(request())).status).toBe(500);
    expect(console.info).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });
});
