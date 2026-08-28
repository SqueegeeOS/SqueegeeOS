import { describe, expect, it } from "vitest";
import {
  enrollmentMembershipBillingState,
  MANUAL_PAYMENT_BILLING_PAUSE_REASON,
} from "./membership-billing-state";

describe("enrollmentMembershipBillingState", () => {
  it("keeps cash/check memberships explicitly outside automatic billing", () => {
    expect(
      enrollmentMembershipBillingState({
        manualPayment: true,
        pausedAt: "2026-08-28T20:04:27.934Z",
      }),
    ).toEqual({
      payment_setup_completed_at: "2026-08-28T20:04:27.934Z",
      automatic_billing_enabled: false,
      automatic_billing_paused_at: "2026-08-28T20:04:27.934Z",
      automatic_billing_pause_reason: MANUAL_PAYMENT_BILLING_PAUSE_REASON,
    });
  });

  it("clears pause metadata only when automatic card billing is enabled", () => {
    expect(
      enrollmentMembershipBillingState({
        manualPayment: false,
        pausedAt: "ignored",
      }),
    ).toEqual({
      payment_setup_completed_at: null,
      automatic_billing_enabled: true,
      automatic_billing_paused_at: null,
      automatic_billing_pause_reason: null,
    });
  });
});
