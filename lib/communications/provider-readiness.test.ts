import { afterEach, describe, expect, it, vi } from "vitest";
import { currentCommunicationWebhookFingerprint } from "./provider-readiness";

afterEach(() => vi.unstubAllEnvs());

describe("communication provider webhook fingerprint", () => {
  it("binds readiness proof to the current provider secret", () => {
    vi.stubEnv("RESEND_WEBHOOK_SECRET", "whsec_first");
    const first = currentCommunicationWebhookFingerprint("resend");
    vi.stubEnv("RESEND_WEBHOOK_SECRET", "whsec_second");
    const second = currentCommunicationWebhookFingerprint("resend");

    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(second).toMatch(/^[0-9a-f]{64}$/);
    expect(second).not.toBe(first);
  });

  it("fails closed when the webhook secret is absent", () => {
    vi.stubEnv("TWILIO_AUTH_TOKEN", "");
    expect(currentCommunicationWebhookFingerprint("twilio")).toBeNull();
  });
});
