import { describe, expect, it } from "vitest";
import {
  paymentHandoffSendLabel,
  resolvePaymentHandoffProgress,
  type PaymentHandoffProgressSource,
} from "./payment-handoff-progress";

const NOW = new Date("2026-08-16T20:00:00.000Z");

function source(
  overrides: Partial<PaymentHandoffProgressSource> = {},
): PaymentHandoffProgressSource {
  return {
    status: "email_sent",
    emailSentAt: "2026-08-16T19:30:00.000Z",
    expiresAt: "2026-08-17T19:30:00.000Z",
    completedAt: null,
    lastErrorCode: null,
    updatedAt: "2026-08-16T19:30:00.000Z",
    ...overrides,
  };
}

describe("payment handoff progress", () => {
  it("starts with one explicit send action when no ledger row exists", () => {
    expect(resolvePaymentHandoffProgress(null, NOW)).toEqual({
      state: "not_started",
      canSend: true,
      emailSentAt: null,
      expiresAt: null,
    });
  });

  it("treats an accepted unexpired email as waiting, not owner work", () => {
    expect(resolvePaymentHandoffProgress(source(), NOW)).toMatchObject({
      state: "email_sent",
      canSend: false,
      emailSentAt: "2026-08-16T19:30:00.000Z",
    });
  });

  it("makes an expired link safely reissuable", () => {
    const result = resolvePaymentHandoffProgress(
      source({ expiresAt: "2026-08-16T19:59:00.000Z" }),
      NOW,
    );

    expect(result).toMatchObject({ state: "expired", canSend: true });
    expect(paymentHandoffSendLabel(result.state)).toBe(
      "Reissue secure Stripe link",
    );
  });

  it("fails closed when an accepted email has no trustworthy expiry", () => {
    expect(
      resolvePaymentHandoffProgress(source({ expiresAt: null }), NOW),
    ).toMatchObject({ state: "review_required", canSend: false });
  });

  it("allows retry only for a delivery failure, not a Stripe binding review", () => {
    expect(
      resolvePaymentHandoffProgress(
        source({
          status: "needs_attention",
          lastErrorCode: "payment_setup_email_failed",
        }),
        NOW,
      ),
    ).toMatchObject({ state: "delivery_failed", canSend: true });
    expect(
      resolvePaymentHandoffProgress(
        source({
          status: "needs_attention",
          lastErrorCode: "stripe_binding_mismatch",
        }),
        NOW,
      ),
    ).toMatchObject({ state: "review_required", canSend: false });
  });

  it("gives an in-flight handoff a grace period before allowing recovery", () => {
    expect(
      resolvePaymentHandoffProgress(
        source({
          status: "session_ready",
          updatedAt: "2026-08-16T19:58:00.000Z",
        }),
        NOW,
      ),
    ).toMatchObject({ state: "preparing", canSend: false });
    expect(
      resolvePaymentHandoffProgress(
        source({
          status: "session_ready",
          updatedAt: "2026-08-16T19:40:00.000Z",
        }),
        NOW,
      ),
    ).toMatchObject({ state: "stalled", canSend: true });
    expect(
      resolvePaymentHandoffProgress(
        source({ status: "session_ready", updatedAt: null }),
        NOW,
      ),
    ).toMatchObject({ state: "review_required", canSend: false });
  });

  it("never offers another send after verified completion", () => {
    expect(
      resolvePaymentHandoffProgress(
        source({
          status: "completed",
          completedAt: "2026-08-16T19:45:00.000Z",
        }),
        NOW,
      ),
    ).toMatchObject({ state: "completed", canSend: false });
  });
});
