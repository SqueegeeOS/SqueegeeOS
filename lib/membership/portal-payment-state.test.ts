import { describe, expect, it } from "vitest";
import {
  PAYMENT_METHOD_ON_FILE_LABEL,
  resolvePortalPaymentState,
} from "./portal-payment-state";

describe("resolvePortalPaymentState", () => {
  it("shows completed payment when setup timestamp is set", () => {
    const state = resolvePortalPaymentState({
      membershipStatus: "active",
      paymentSetupCompletedAt: "2026-01-16T00:00:00Z",
      paymentMethodLabel: "Visa ···· 4242",
      hasMembership: true,
    });

    expect(state.paymentOnFile).toBe(true);
    expect(state.pendingPayment).toBe(false);
    expect(state.membershipActive).toBe(true);
    expect(state.headline).toBe("Visa ···· 4242");
    expect(state.showUpdatePaymentMethod).toBe(true);
  });

  it("falls back when Stripe details are unavailable", () => {
    const state = resolvePortalPaymentState({
      membershipStatus: "active",
      paymentSetupCompletedAt: "2026-01-16T00:00:00Z",
      paymentMethodLabel: null,
      hasMembership: true,
    });

    expect(state.headline).toBe(PAYMENT_METHOD_ON_FILE_LABEL);
    expect(state.paymentOnFile).toBe(true);
    expect(state.pendingPayment).toBe(false);
  });

  it("shows unfinished setup when payment is not complete", () => {
    const state = resolvePortalPaymentState({
      membershipStatus: "pending_payment",
      paymentSetupCompletedAt: null,
      paymentMethodLabel: null,
      hasMembership: true,
    });

    expect(state.paymentOnFile).toBe(false);
    expect(state.pendingPayment).toBe(true);
    expect(state.headline).toBe("Add payment method");
    expect(state.showUpdatePaymentMethod).toBe(false);
  });
});
