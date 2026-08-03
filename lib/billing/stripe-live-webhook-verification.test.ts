import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isStripeLiveMode: vi.fn(),
  create: vi.fn(),
  cancel: vi.fn(),
}));

vi.mock("@/lib/stripe/mode", () => ({
  isStripeLiveMode: mocks.isStripeLiveMode,
}));
vi.mock("@/lib/stripe/server", () => ({
  getStripe: () => ({
    setupIntents: { create: mocks.create, cancel: mocks.cancel },
  }),
}));

import { requestStripeLiveWebhookVerification } from "./stripe-live-webhook-verification";

describe("live Stripe webhook verification request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_live_current";
    mocks.isStripeLiveMode.mockReturnValue(true);
    mocks.create.mockResolvedValue({ id: "seti_verify", livemode: true });
    mocks.cancel.mockResolvedValue({ id: "seti_verify", status: "canceled" });
  });

  it("creates and cancels a no-payment SetupIntent", async () => {
    await expect(requestStripeLiveWebhookVerification()).resolves.toEqual({
      setupIntentId: "seti_verify",
      livemode: true,
    });

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        usage: "off_session",
        payment_method_types: ["card"],
        metadata: expect.objectContaining({
          homeatlas_operation: "live_webhook_verification",
        }),
      }),
      expect.objectContaining({
        idempotencyKey: expect.stringContaining(
          "homeatlas-live-webhook-verification:",
        ),
      }),
    );
    expect(mocks.cancel).toHaveBeenCalledWith("seti_verify");
  });

  it("refuses to request verification with non-live Stripe keys", async () => {
    mocks.isStripeLiveMode.mockReturnValue(false);

    await expect(requestStripeLiveWebhookVerification()).rejects.toThrow(
      "Live Stripe publishable and secret keys are required",
    );
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
