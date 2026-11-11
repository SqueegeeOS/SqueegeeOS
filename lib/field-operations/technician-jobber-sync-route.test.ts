import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), sync: vi.fn(), dispatch: vi.fn(), after: vi.fn(), pending: vi.fn() }));
vi.mock("next/server", async () => ({ ...await vi.importActual<typeof import("next/server")>("next/server"), after: mocks.after }));
vi.mock("@/lib/field-operations/field-access", () => ({ authorizeFieldRequest: mocks.auth }));
vi.mock("@/lib/care-operations/jobber-visit-sync", () => ({ syncAllJobberVisits: mocks.sync }));
vi.mock("@/lib/field-operations/live-dispatch-server", () => ({ reconcilePendingLiveDispatchJobs: mocks.dispatch }));
vi.mock("@/lib/integrations/jobber-webhook", () => ({ processPendingJobberWebhooks: mocks.pending }));
import { POST } from "@/app/api/field/jobber-sync/route";
import { JobberSyncBusyError } from "@/lib/care-operations/jobber-sync-lease";
beforeEach(() => {
  vi.resetAllMocks(); mocks.auth.mockResolvedValue({ kind: "technician", jobberUserId: "tech-1" });
  mocks.sync.mockResolvedValue({ observed: 473, inserted: 1, changed: 1 });
  mocks.dispatch.mockResolvedValue({ reconciled: 1, warnings: [] });
});
describe("technician refresh during shared sync", () => {
  it("shows already-syncing rather than claiming fresh data or starting duplicate dispatch work", async () => {
    mocks.sync.mockRejectedValue(new JobberSyncBusyError());
    const response = await POST(new Request("https://example.test/api/field/jobber-sync", { method: "POST" }));
    expect(response.status).toBe(409); expect(response.headers.get("retry-after")).toBe("15");
    expect(await response.json()).toEqual({ error: "Jobber is already syncing. Please refresh again shortly." });
    expect(mocks.dispatch).not.toHaveBeenCalled();
    await mocks.after.mock.calls[0][0](); expect(mocks.pending).toHaveBeenCalledTimes(1);
  });
  it("keeps normal visit sync and local dispatch reconciliation working", async () => {
    const response = await POST(new Request("https://example.test/api/field/jobber-sync", { method: "POST" }));
    expect(response.status).toBe(200); expect(mocks.dispatch).toHaveBeenCalledTimes(1);
    expect(await response.json()).toMatchObject({ ok: true, observedVisits: 473, reconciledLiveJobs: 1 });
    expect(mocks.after).toHaveBeenCalledTimes(1);
  });
  it("does not start any sync/recovery work for an unauthorized caller", async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await POST(new Request("https://example.test/api/field/jobber-sync", { method: "POST" }))).status).toBe(401);
    expect(mocks.sync).not.toHaveBeenCalled(); expect(mocks.after).not.toHaveBeenCalled();
  });
});
