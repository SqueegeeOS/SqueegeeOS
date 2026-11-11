import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ init: vi.fn(), claim: vi.fn(), release: vi.fn(), update: vi.fn(), filter: vi.fn(), owners: [] as string[] }));
vi.mock("@/lib/persistence/supabase/client", () => ({
  createServiceRoleSupabaseClient: () => ({ from: () => ({
    upsert: mocks.init,
    update: (value: { lease_id: string | null }) => {
      mocks.update(value);
      return { eq: () => value.lease_id
        ? { or: (filter: string) => { mocks.filter(filter); return { select: () => ({ maybeSingle: mocks.claim }) }; } }
        : { eq: (_column: string, owner: string) => { mocks.owners.push(owner); return mocks.release(); } } };
    },
  }) }),
}));
import { JobberSyncBusyError, withClaimedJobberSyncLease, withJobberSyncLease } from "./jobber-sync-lease";

beforeEach(() => {
  vi.resetAllMocks(); mocks.owners.length = 0;
  mocks.init.mockResolvedValue({ error: null });
  mocks.claim.mockResolvedValue({ data: { lease_id: "owned" }, error: null });
  mocks.release.mockResolvedValue({ error: null });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("shared Jobber snapshot lease", () => {
  it("acquires atomically without resetting an existing owner and releases only its own owner", async () => {
    expect(await withJobberSyncLease(async () => "done")).toBe("done");
    expect(mocks.init).toHaveBeenCalledWith({ connection_id: "squeegeeking" }, { onConflict: "connection_id", ignoreDuplicates: true });
    expect(mocks.filter).toHaveBeenCalledWith(expect.stringMatching(/^lease_id\.is\.null,expires_at\.lte\./));
    expect(mocks.owners).toEqual([mocks.update.mock.calls[0][0].lease_id]);
    const acquired = mocks.update.mock.calls[0][0];
    expect(Date.parse(acquired.expires_at) - Date.now()).toBeGreaterThan(329_000);
  });
  it("does no work and never releases another snapshot's lock when busy", async () => {
    mocks.claim.mockResolvedValue({ data: null, error: null });
    const work = vi.fn();
    await expect(withJobberSyncLease(work)).rejects.toBeInstanceOf(JobberSyncBusyError);
    expect(work).not.toHaveBeenCalled(); expect(mocks.release).not.toHaveBeenCalled();
  });
  it("shares one lock for nested full/client/visit work", async () => {
    await withJobberSyncLease(() => withJobberSyncLease(() => withJobberSyncLease(async () => "ok")));
    expect(mocks.claim).toHaveBeenCalledTimes(1); expect(mocks.release).toHaveBeenCalledTimes(1);
  });
  it("adopts a webhook's database claim without reacquiring or prematurely releasing it", async () => {
    expect(await withClaimedJobberSyncLease("webhook-owner", () => withJobberSyncLease(async () => "ok"))).toBe("ok");
    expect(mocks.init).not.toHaveBeenCalled(); expect(mocks.release).not.toHaveBeenCalled();
  });
  it("does not leak ownership into an independent concurrent request", async () => {
    let complete!: () => void;
    const running = withJobberSyncLease(() => new Promise<void>(resolve => { complete = resolve; }));
    await vi.waitFor(() => expect(complete).toBeTypeOf("function"));
    mocks.claim.mockResolvedValue({ data: null, error: null });
    await expect(withJobberSyncLease(async () => "bad")).rejects.toBeInstanceOf(JobberSyncBusyError);
    complete(); await running;
    expect(mocks.claim).toHaveBeenCalledTimes(2);
  });
  it("releases after a failed snapshot and allows a later retry", async () => {
    await expect(withJobberSyncLease(async () => { throw new Error("provider failed"); })).rejects.toThrow("provider failed");
    expect(mocks.release).toHaveBeenCalledTimes(1);
    expect(await withJobberSyncLease(async () => "retry")).toBe("retry");
    expect(mocks.claim).toHaveBeenCalledTimes(2);
  });
  it.each(["init", "claim"] as const)("fails closed when %s errors", async (stage) => {
    mocks[stage].mockResolvedValue({ data: null, error: { message: "offline" } });
    const work = vi.fn(); await expect(withJobberSyncLease(work)).rejects.toThrow("lease");
    expect(work).not.toHaveBeenCalled(); expect(mocks.release).not.toHaveBeenCalled();
  });
  it("retains the original outcome on release transport failure, leaving expiry to recover", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.release.mockRejectedValue(new Error("offline"));
    await expect(withJobberSyncLease(async () => { throw new Error("provider failed"); })).rejects.toThrow("provider failed");
    expect(await withJobberSyncLease(async () => "ok")).toBe("ok");
  });
  it("lets a scheduled workflow wait for a normal overlap then take its own fresh snapshot", async () => {
    vi.useFakeTimers();
    mocks.claim.mockResolvedValueOnce({ data: null, error: null }).mockResolvedValueOnce({ data: null, error: null });
    const work = vi.fn().mockResolvedValue("fresh");
    const task = withJobberSyncLease(work, { waitForLeaseMs: 90_000 });
    const result = expect(task).resolves.toBe("fresh");
    await vi.runAllTimersAsync(); await result;
    expect(mocks.claim).toHaveBeenCalledTimes(3);
    expect(work).toHaveBeenCalledTimes(1); expect(mocks.release).toHaveBeenCalledTimes(1);
  });
  it("bounds the scheduled wait and never runs downstream work without acquiring the lease", async () => {
    vi.useFakeTimers();
    mocks.claim.mockResolvedValue({ data: null, error: null });
    const work = vi.fn();
    const task = withJobberSyncLease(work, { waitForLeaseMs: 2_500 });
    const result = expect(task).rejects.toBeInstanceOf(JobberSyncBusyError);
    await vi.runAllTimersAsync(); await result;
    expect(mocks.claim).toHaveBeenCalledTimes(4);
    expect(work).not.toHaveBeenCalled(); expect(mocks.release).not.toHaveBeenCalled();
  });

});
