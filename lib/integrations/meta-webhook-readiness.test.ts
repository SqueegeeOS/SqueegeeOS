import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("@/lib/persistence/supabase/client", () => ({
  createServiceRoleSupabaseClient: () => ({ from: mocks.from }),
}));

import {
  readCurrentMetaWebhookProof,
  recordCurrentMetaWebhookProof,
} from "./meta-webhook-readiness";

function proofId(kind: string, secret: string): string {
  const fingerprint = createHash("sha256").update(secret, "utf8").digest("hex");
  return `readiness:${kind}:${fingerprint}`;
}

afterEach(() => {
  mocks.from.mockReset();
  vi.unstubAllEnvs();
});

describe("Meta webhook readiness proof", () => {
  it("stores only a fingerprint after the callback challenge", async () => {
    const verifyToken = "private-meta-verify-token";
    vi.stubEnv("META_WEBHOOK_VERIFY_TOKEN", verifyToken);
    const upsert = vi.fn().mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({ upsert });

    await recordCurrentMetaWebhookProof({
      kind: "callback_challenge",
      payload: "challenge-value",
    });

    const row = upsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(mocks.from).toHaveBeenCalledWith(
      "customer_communication_webhook_events",
    );
    expect(row.provider).toBe("meta");
    expect(row.provider_event_id).toBe(
      proofId("callback_challenge", verifyToken),
    );
    expect(JSON.stringify(row)).not.toContain(verifyToken);
  });

  it("recognizes only proofs tied to the current verify token and app secret", async () => {
    const verifyToken = "current-verify-token";
    const appSecret = "current-app-secret";
    vi.stubEnv("META_WEBHOOK_VERIFY_TOKEN", verifyToken);
    vi.stubEnv("META_APP_SECRET", appSecret);
    const expectedIds = [
      proofId("callback_challenge", verifyToken),
      proofId("signed_event", appSecret),
    ];
    const inQuery = vi.fn().mockResolvedValue({
      data: expectedIds.map((providerEventId) => ({
        provider_event_id: providerEventId,
      })),
      error: null,
    });
    mocks.from.mockReturnValue({
      select: () => ({
        eq: () => ({ in: inQuery }),
      }),
    });

    await expect(readCurrentMetaWebhookProof()).resolves.toEqual({
      available: true,
      callbackChallengeVerified: true,
      signedWebhookVerified: true,
    });
    expect(inQuery).toHaveBeenCalledWith("provider_event_id", expectedIds);
  });

  it("fails closed when proof storage cannot be read", async () => {
    vi.stubEnv("META_APP_SECRET", "current-app-secret");
    mocks.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          in: vi.fn().mockResolvedValue({ data: null, error: { message: "nope" } }),
        }),
      }),
    });

    await expect(readCurrentMetaWebhookProof()).resolves.toEqual({
      available: false,
      callbackChallengeVerified: false,
      signedWebhookVerified: false,
    });
  });
});
