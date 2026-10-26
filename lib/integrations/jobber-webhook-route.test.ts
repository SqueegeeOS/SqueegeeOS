import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ after: vi.fn(), record: vi.fn(), process: vi.fn(), signature: vi.fn(), secret: vi.fn() }));
vi.mock("next/server", async () => ({ ...(await vi.importActual("next/server")), after: mocks.after }));
vi.mock("@/lib/care-operations/jobber-oauth-config", () => ({ getJobberClientSecret: mocks.secret }));
vi.mock("@/lib/integrations/webhook-signatures", () => ({ verifyJobberWebhookSignature: mocks.signature }));
vi.mock("@/lib/integrations/jobber-webhook", () => ({
  parseJobberWebhookPayload: (payload: string) => { try { return JSON.parse(payload); } catch { return null; } },
  recordJobberWebhook: mocks.record, processPendingJobberWebhooks: mocks.process,
}));
import { POST, maxDuration } from "@/app/api/integrations/jobber/webhook/route";

function request(body = JSON.stringify({ topic: "VISIT_CREATE", accountId: "account-1" })) {
  return new Request("https://example.test/api/integrations/jobber/webhook", {
    method: "POST", body, headers: { "x-jobber-hmac-sha256": "test-signature" },
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.secret.mockReturnValue("test-secret"); mocks.signature.mockReturnValue(true);
  mocks.record.mockResolvedValue(undefined);
});

describe("Jobber delivery acknowledgement", () => {
  it("waits for durable storage before returning 202 or scheduling a worker", async () => {
    let persist!: () => void;
    mocks.record.mockImplementation(() => new Promise<void>((resolve) => { persist = resolve; }));
    let completed = false;
    const response = POST(request()).then((result) => { completed = true; return result; });
    await vi.waitFor(() => expect(mocks.record).toHaveBeenCalledTimes(1));
    expect(completed).toBe(false); expect(mocks.after).not.toHaveBeenCalled();
    persist();
    expect((await response).status).toBe(202);
    expect(mocks.process).not.toHaveBeenCalled();
    await mocks.after.mock.calls[0][0]();
    expect(mocks.process).toHaveBeenCalledTimes(1);
    expect(maxDuration).toBe(300);
  });
  it("returns retryable failure instead of acknowledging a lost event", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.record.mockRejectedValue(new Error("database unavailable"));
    expect((await POST(request())).status).toBe(503);
    expect(mocks.after).not.toHaveBeenCalled(); log.mockRestore();
  });
  it("rejects unauthenticated delivery before persistence or worker execution", async () => {
    mocks.signature.mockReturnValue(false);
    expect((await POST(request())).status).toBe(401);
    expect(mocks.record).not.toHaveBeenCalled(); expect(mocks.after).not.toHaveBeenCalled();
  });
  it("rejects invalid payloads and unconfigured signatures", async () => {
    expect((await POST(request("not-json"))).status).toBe(400);
    mocks.secret.mockImplementation(() => { throw new Error("unconfigured"); });
    expect((await POST(request())).status).toBe(503);
    expect(mocks.record).not.toHaveBeenCalled();
  });
});
