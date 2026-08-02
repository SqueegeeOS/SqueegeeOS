import { describe, expect, it } from "vitest";
import {
  automaticBillingSmsDeliveryAt,
  buildAutomaticBillingNotificationContent,
} from "./automatic-billing-notifications";

const baseInput = {
  billingOrderId: "order-123",
  homeownerFirstName: "Avery",
  scheduledServiceAt: "2026-08-15T17:00:00.000Z",
  amountCents: 25000,
  attemptNumber: 1,
};

describe("automatic billing customer notifications", () => {
  it("deduplicates a paid receipt across executor attempts and webhooks", () => {
    const first = buildAutomaticBillingNotificationContent({
      ...baseInput,
      outcome: "paid",
      portalUrl: null,
    });
    const raced = buildAutomaticBillingNotificationContent({
      ...baseInput,
      attemptNumber: 2,
      outcome: "paid",
      portalUrl: null,
    });

    expect(first.idempotencyKey).toBe("billing:order-123:paid:email:v1");
    expect(raced.idempotencyKey).toBe(first.idempotencyKey);
    expect(first.body).toContain("$250.00");
    expect(first.body).toContain("August 15, 2026");
    expect(first.smsBody).toBeNull();
    expect(first.smsIdempotencyKey).toBeNull();
  });

  it("creates per-attempt email and consent-gated SMS content for payment action", () => {
    const content = buildAutomaticBillingNotificationContent({
      ...baseInput,
      outcome: "needs_action",
      portalUrl: "https://www.squeegeeking.net/member/example",
    });

    expect(content.idempotencyKey).toBe(
      "billing:order-123:needs_action:attempt:1:email:v1",
    );
    expect(content.smsIdempotencyKey).toBe(
      "billing:order-123:needs_action:attempt:1:sms:v1",
    );
    expect(content.body).toContain(
      "https://www.squeegeeking.net/member/example",
    );
    expect(content.smsBody).toContain("Reply STOP to opt out.");
  });

  it("defers payment-action texts until Pacific quiet hours end", () => {
    expect(automaticBillingSmsDeliveryAt("2026-08-03T04:30:00.000Z")).toBe(
      "2026-08-03T15:00:00.000Z",
    );
    expect(automaticBillingSmsDeliveryAt("2026-08-02T17:00:00.000Z")).toBe(
      "2026-08-02T17:00:00.000Z",
    );
  });
});
