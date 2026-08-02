import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  processStripeBillingWebhook: vi.fn(),
}));

vi.mock("@/lib/stripe/server", () => ({
  getStripe: () => ({
    webhooks: { constructEvent: mocks.constructEvent },
  }),
}));
vi.mock("@/lib/billing/stripe-billing-webhook", () => ({
  processStripeBillingWebhook: mocks.processStripeBillingWebhook,
}));

import { POST } from "@/app/api/integrations/stripe/webhook/route";

function webhookRequest(signature?: string): Request {
  return new Request("https://www.squeegeeking.net/api/integrations/stripe/webhook", {
    method: "POST",
    headers: signature ? { "stripe-signature": signature } : undefined,
    body: "raw=signed&payload",
  });
}

describe("Stripe billing webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  });

  it("rejects a request without Stripe's signature before parsing the body", async () => {
    const response = await POST(webhookRequest());

    expect(response.status).toBe(400);
    expect(mocks.constructEvent).not.toHaveBeenCalled();
  });

  it("verifies the untouched raw body and returns 500 for a retryable local failure", async () => {
    const event = { id: "evt_123" } as Stripe.Event;
    mocks.constructEvent.mockReturnValue(event);
    mocks.processStripeBillingWebhook.mockRejectedValue(
      new Error("transient database outage"),
    );

    const response = await POST(webhookRequest("t=1,v1=signature"));

    expect(mocks.constructEvent).toHaveBeenCalledWith(
      "raw=signed&payload",
      "t=1,v1=signature",
      "whsec_test",
    );
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Stripe webhook processing failed and will be retried",
    });
  });
});
