import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ sync: vi.fn(), lease: vi.fn(), reconcile: vi.fn(), process: vi.fn(), after: vi.fn() }));
vi.mock("next/server", async () => ({ ...await vi.importActual<typeof import("next/server")>("next/server"), after: mocks.after }));
vi.mock("@/lib/care-operations/jobber-full-sync", () => ({ syncAllJobberData: mocks.sync }));
vi.mock("@/lib/integrations/jobber-webhook", () => ({ markJobberWebhookEventsReconciled: mocks.reconcile, processPendingJobberWebhooks: mocks.process }));
vi.mock("@/lib/care-operations/jobber-sync-lease", async () => ({ ...await vi.importActual<typeof import("@/lib/care-operations/jobber-sync-lease")>("@/lib/care-operations/jobber-sync-lease"), withJobberSyncLease: mocks.lease }));
import { GET, maxDuration } from "@/app/api/cron/jobber-sync/route";
import { JobberSyncBusyError } from "@/lib/care-operations/jobber-sync-lease";
const request = (auth = "Bearer test-secret") => new Request("https://example.test/api/cron/jobber-sync", { headers: { authorization: auth } });
beforeEach(() => {
  vi.resetAllMocks(); process.env.CRON_SECRET = "test-secret";
  mocks.lease.mockImplementation(async (fn: () => Promise<unknown>) => fn());
  mocks.sync.mockResolvedValue({ clients: { observed: 350 }, visits: { observed: 473 } });
  mocks.reconcile.mockResolvedValue({ pendingEventsReconciled: 0, staleProcessingEventsReconciled: 0 });
});
describe("15-minute sync-only fallback", () => {
  it.each(["", "Bearer wrong", "test-secret"])("rejects unauthorized request %s before any work", async auth => {
    expect((await GET(request(auth))).status).toBe(401); expect(mocks.sync).not.toHaveBeenCalled(); expect(mocks.lease).not.toHaveBeenCalled();
  });
  it("fails closed when the cron secret is missing", async () => {
    delete process.env.CRON_SECRET;
    expect((await GET(request())).status).toBe(401);
  });
  it("holds the shared lease through successful snapshot acknowledgement and wakes newer events", async () => {
    let leased = false;
    mocks.lease.mockImplementation(async fn => { leased = true; try { return await fn(); } finally { leased = false; } });
    mocks.reconcile.mockImplementation(async () => { expect(leased).toBe(true); return {}; });
    const response = await GET(request());
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.reconcile).toHaveBeenCalledWith({ snapshotStartedAt: expect.any(String), syncSummary: await mocks.sync.mock.results[0].value });
    expect(mocks.after).toHaveBeenCalledTimes(1); await mocks.after.mock.calls[0][0](); expect(mocks.process).toHaveBeenCalledTimes(1);
    expect(maxDuration).toBe(300);
  });
  it("reports busy as skipped rather than a completed sync", async () => {
    mocks.lease.mockRejectedValue(new JobberSyncBusyError());
    const response = await GET(request()); expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ ok: true, skipped: "sync_in_progress" });
    expect(mocks.sync).not.toHaveBeenCalled(); expect(mocks.reconcile).not.toHaveBeenCalled();
    expect(mocks.after).toHaveBeenCalledTimes(1);
  });
  it("does not acknowledge events after a provider failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.sync.mockRejectedValue(new Error("provider down"));
    expect((await GET(request())).status).toBe(500); expect(mocks.reconcile).not.toHaveBeenCalled();
    expect(mocks.after).toHaveBeenCalledTimes(1);
  });
  it("leaves billing and communications schedules unchanged and keeps side effects out of the route", () => {
    const config = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8"));
    expect(config.crons).toContainEqual({ path: "/api/cron/jobber-sync", schedule: "11,26,41,56 * * * *" });
    expect(config.crons).toContainEqual({ path: "/api/cron/jobber-reconcile", schedule: "17 17 * * *" });
    expect(config.crons).toContainEqual({ path: "/api/cron/communications", schedule: "35 17 * * *" });
    expect(config.crons).toContainEqual({ path: "/api/cron/automatic-billing", schedule: "7 8 1 * *" });
    const source = readFileSync(new URL("../../app/api/cron/jobber-sync/route.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/runAutomaticMembershipBilling|processDueScheduledCommunications|processVerifiedAppointmentReminders|processEligibleReviewRequests|geocodeTerritoryBacklog/);
  });
});
