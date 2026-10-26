import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(), upsert: vi.fn(), release: vi.fn(),
  connection: vi.fn(), token: vi.fn(), clients: vi.fn(), visits: vi.fn(), full: vi.fn(),
}));
vi.mock("@/lib/persistence/supabase/client", () => ({
  createServiceRoleSupabaseClient: () => ({
    rpc: mocks.rpc,
    from: (table: string) => {
      if (table === "jobber_webhook_events") return { upsert: mocks.upsert };
      return { update: (value: unknown) => ({ eq: (column: string, connection: string) => ({
        eq: (ownerColumn: string, owner: string) => mocks.release(value, column, connection, ownerColumn, owner),
      }) }) };
    },
  }),
}));
vi.mock("@/lib/care-operations/jobber-connection-store", () => ({
  readJobberConnectionStatus: mocks.connection, getFreshJobberAccessToken: mocks.token,
}));
vi.mock("@/lib/care-operations/jobber-customer-matching", () => ({ syncAllJobberClients: mocks.clients }));
vi.mock("@/lib/care-operations/jobber-visit-sync", () => ({ syncAllJobberVisits: mocks.visits }));
vi.mock("@/lib/care-operations/jobber-full-sync", () => ({ syncAllJobberData: mocks.full }));
import { parseJobberWebhookPayload, processPendingJobberWebhooks, recordJobberWebhook } from "./jobber-webhook";

type Event = { event_key: string; sync_scope: "clients" | "visits" | "full" };
function batches(...events: Event[][]) {
  mocks.rpc.mockImplementation(async (name: string) => name === "claim_jobber_webhook_batch"
    ? { data: { acquired: true, events: events.shift() ?? [] }, error: null }
    : { data: 1, error: null });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.connection.mockResolvedValue({ connected: true, accountId: "account-1" });
  mocks.token.mockResolvedValue("test-token");
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.release.mockResolvedValue({ error: null });
  mocks.clients.mockResolvedValue({ observed: 2 });
  mocks.visits.mockResolvedValue({ observed: 4 });
  mocks.full.mockResolvedValue({ clients: { observed: 2 }, visits: { observed: 4 } });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("durable Jobber inbox", () => {
  it("does not overwrite a duplicate's completed or failed state", async () => {
    await recordJobberWebhook({ rawPayload: "signed body", event: { topic: "VISIT_CREATE", accountId: "account-1" } });
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ status: "received", account_id: "account-1" }), {
      onConflict: "event_key", ignoreDuplicates: true,
    });
    expect(mocks.visits).not.toHaveBeenCalled();
  });
  it("throws on inbox failure so the route can request redelivery", async () => {
    mocks.upsert.mockResolvedValue({ error: { message: "database unavailable" } });
    await expect(recordJobberWebhook({ rawPayload: "body", event: { topic: "JOB_CREATE" } })).rejects.toThrow("persistence failed");
  });
  it("persists unsupported topics as ignored without another write", async () => {
    await recordJobberWebhook({ rawPayload: "body", event: { topic: "INVOICE_CREATE" } });
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ status: "ignored" }), expect.anything());
  });
  it.each([null, [], { topic: "VISIT_UPDATE", accountId: 42 }, { topic: "VISIT_UPDATE", itemId: {} }])(
    "rejects malformed provider payload %j", (payload) => {
      expect(parseJobberWebhookPayload(JSON.stringify(payload))).toBeNull();
    },
  );
});

describe("coalesced Jobber webhook worker", () => {
  it("runs one visit snapshot for an entire burst", async () => {
    batches([{ event_key: "job", sync_scope: "visits" }, { event_key: "visit", sync_scope: "visits" }]);
    await processPendingJobberWebhooks();
    expect(mocks.visits).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("finish_jobber_webhook_batch", expect.objectContaining({
      p_event_keys: ["job", "visit"], p_sync_summary: { observed: 4 }, p_error_code: null,
    }));
    expect(mocks.release).toHaveBeenCalledWith({ lease_id: null, expires_at: null }, "connection_id", "squeegeeking", "lease_id", expect.any(String));
  });
  it("performs one full snapshot for mixed client and visit changes", async () => {
    batches([{ event_key: "client", sync_scope: "clients" }, { event_key: "visit", sync_scope: "visits" }]);
    await processPendingJobberWebhooks();
    expect(mocks.full).toHaveBeenCalledTimes(1);
    expect(mocks.clients).not.toHaveBeenCalled();
    expect(mocks.visits).not.toHaveBeenCalled();
  });
  it("runs the matching scope for client-only and property batches", async () => {
    batches([{ event_key: "client", sync_scope: "clients" }], [{ event_key: "property", sync_scope: "full" }]);
    await processPendingJobberWebhooks();
    expect(mocks.clients).toHaveBeenCalledTimes(1);
    expect(mocks.full).toHaveBeenCalledTimes(1);
  });
  it("never starts an overlapping snapshot when another instance owns the lease", async () => {
    mocks.rpc.mockResolvedValue({ data: { acquired: false, events: [] }, error: null });
    await processPendingJobberWebhooks();
    expect(mocks.token).not.toHaveBeenCalled();
    expect(mocks.full).not.toHaveBeenCalled();
    expect(mocks.release).not.toHaveBeenCalled();
  });
  it("does not acknowledge events arriving after the claimed snapshot", async () => {
    batches([{ event_key: "before", sync_scope: "visits" }], [{ event_key: "during", sync_scope: "visits" }]);
    await processPendingJobberWebhooks();
    expect(mocks.visits).toHaveBeenCalledTimes(2);
    const completions = mocks.rpc.mock.calls.filter(([name]) => name === "finish_jobber_webhook_batch");
    expect(completions.map(([, args]) => args.p_event_keys)).toEqual([["before"], ["during"]]);
  });
  it("retries a transient failure and only marks a completed snapshot successful", async () => {
    vi.useFakeTimers();
    batches([{ event_key: "retry", sync_scope: "visits" }], [{ event_key: "retry", sync_scope: "visits" }]);
    mocks.visits.mockRejectedValueOnce(new Error("throttled"));
    const task = processPendingJobberWebhooks();
    await vi.runAllTimersAsync(); await task;
    expect(mocks.visits).toHaveBeenCalledTimes(2);
    const completions = mocks.rpc.mock.calls.filter(([name]) => name === "finish_jobber_webhook_batch");
    expect(completions.map(([, args]) => args.p_error_code)).toEqual(["jobber_rate_limited", null]);
  });
  it("keeps persistent failures retryable without an unbounded hot loop", async () => {
    vi.useFakeTimers();
    batches([{ event_key: "retry", sync_scope: "visits" }], [{ event_key: "retry", sync_scope: "visits" }]);
    mocks.visits.mockRejectedValue(new Error("upstream unavailable"));
    const task = processPendingJobberWebhooks();
    await vi.runAllTimersAsync(); await task;
    expect(mocks.visits).toHaveBeenCalledTimes(2);
    expect(mocks.rpc.mock.calls.filter(([name]) => name === "finish_jobber_webhook_batch")
      .every(([, args]) => args.p_error_code === "jobber_sync_failed")).toBe(true);
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });
  it("leaves events durable when disconnected or the migration is missing", async () => {
    mocks.connection.mockResolvedValueOnce({ connected: false, accountId: null });
    await processPendingJobberWebhooks();
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    await processPendingJobberWebhooks();
    expect(mocks.visits).not.toHaveBeenCalled();
  });
  it("does not claim another batch after its soft time budget", async () => {
    vi.useFakeTimers();
    batches([{ event_key: "slow", sync_scope: "visits" }]);
    mocks.visits.mockImplementation(async () => { vi.setSystemTime(Date.now() + 181_000); return { observed: 4 }; });
    await processPendingJobberWebhooks();
    expect(mocks.rpc.mock.calls.filter(([name]) => name === "claim_jobber_webhook_batch")).toHaveLength(1);
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });
});
