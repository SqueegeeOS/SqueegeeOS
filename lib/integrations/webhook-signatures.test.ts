import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import {
  verifyJobberWebhookSignature,
  verifySvixWebhookSignature,
} from "./webhook-signatures";

describe("Jobber webhook signatures", () => {
  it("accepts a base64 HMAC over the raw payload", () => {
    const payload = '{"topic":"CLIENT_UPDATE","itemId":"client-1"}';
    const secret = "jobber-client-secret";
    const signature = createHmac("sha256", secret)
      .update(payload)
      .digest("base64");
    expect(
      verifyJobberWebhookSignature({ payload, signature, secret }),
    ).toBe(true);
  });

  it("rejects a changed payload", () => {
    const secret = "jobber-client-secret";
    const signature = createHmac("sha256", secret)
      .update("original")
      .digest("base64");
    expect(
      verifyJobberWebhookSignature({ payload: "changed", signature, secret }),
    ).toBe(false);
  });
});

describe("Svix webhook signatures", () => {
  it("matches the official Svix verification vector", () => {
    expect(
      verifySvixWebhookSignature({
        payload: '{"test": 2432232314}',
        messageId: "msg_p5jXN8AQM9LWM0D4loKWxJek",
        timestamp: "1614265330",
        signature: "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=",
        secret: "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw",
        nowSeconds: 1614265330,
      }),
    ).toBe(true);
  });

  it("rejects stale signed deliveries", () => {
    expect(
      verifySvixWebhookSignature({
        payload: '{"test": 2432232314}',
        messageId: "msg_p5jXN8AQM9LWM0D4loKWxJek",
        timestamp: "1614265330",
        signature: "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=",
        secret: "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw",
        nowSeconds: 1614266000,
      }),
    ).toBe(false);
  });
});
