import { describe, expect, it } from "vitest";
import {
  manualSendFingerprint,
  resolveManualSendAttempt,
} from "./manual-send-idempotency";

describe("manual communication send idempotency", () => {
  it("reuses a key for an exact network retry", () => {
    const fingerprint = manualSendFingerprint({
      conversationId: "conversation-1",
      channel: "email",
      subject: " Hello ",
      body: " Same message ",
    });
    const first = resolveManualSendAttempt(null, fingerprint, () => "attempt-1");
    const retry = resolveManualSendAttempt(first, fingerprint, () => "attempt-2");

    expect(retry).toEqual(first);
    expect(retry.idempotencyKey).toBe("hq-manual:attempt-1");
  });

  it("rotates when the destination, channel, or composed content changes", () => {
    const originalFingerprint = manualSendFingerprint({
      conversationId: "conversation-1",
      channel: "sms",
      body: "Original",
    });
    const first = resolveManualSendAttempt(null, originalFingerprint, () => "one");
    const changedFingerprint = manualSendFingerprint({
      conversationId: "conversation-1",
      channel: "sms",
      body: "Changed",
    });
    const changed = resolveManualSendAttempt(first, changedFingerprint, () => "two");

    expect(changed.idempotencyKey).toBe("hq-manual:two");
    expect(changed.fingerprint).not.toBe(first.fingerprint);
  });
});
