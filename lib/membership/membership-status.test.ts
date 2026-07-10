import { describe, expect, it } from "vitest";
import {
  canBillMembership,
  canScheduleMembership,
  hasPaymentMethodOnFile,
  hasPaymentSignal,
  isMembershipActive,
  isMembershipCancelled,
  resolveHqMembershipDisplayStatus,
  resolvePortalMembershipStatus,
  resolveStripePaymentStatus,
} from "./membership-status";

describe("isMembershipActive", () => {
  it("is active only when status is active AND payment is completed AND tier/price/agreement are set", () => {
    expect(
      isMembershipActive({
        status: "active",
        payment_setup_completed_at: "2026-01-01T00:00:00Z",
        agreement_id: "agreement-1",
        sales_tier: "quarterly",
        visit_price: 200,
      }),
    ).toBe(true);
  });

  it("is active with status and payment when agreement fields are omitted (partial row)", () => {
    expect(
      isMembershipActive({
        status: "active",
        payment_setup_completed_at: "2026-01-01T00:00:00Z",
      }),
    ).toBe(true);
  });

  it("is not active when agreement_id is explicitly null on an active row", () => {
    expect(
      isMembershipActive({
        status: "active",
        payment_setup_completed_at: "2026-01-01T00:00:00Z",
        agreement_id: null,
      }),
    ).toBe(false);
  });

  it("is not active when status is active but payment never completed", () => {
    // This is the exact drift bug: several call sites used to count this
    // row as an active member because they only checked `status`.
    expect(
      isMembershipActive({
        status: "active",
        payment_setup_completed_at: null,
      }),
    ).toBe(false);
  });

  it("is not active when payment is on file but status has not flipped to active", () => {
    expect(
      isMembershipActive({
        status: "pending_payment",
        payment_setup_completed_at: null,
        stripe_payment_method_id: "pm_123",
      }),
    ).toBe(false);
  });
});

describe("resolveHqMembershipDisplayStatus", () => {
  it("maps active members with and without a scheduled visit", () => {
    const baseActive = {
      status: "active",
      payment_setup_completed_at: "2026-01-01T00:00:00Z",
      agreement_id: "agreement-1",
      sales_tier: "quarterly",
      visit_price: 200,
    };

    expect(
      resolveHqMembershipDisplayStatus({
        ...baseActive,
        nextScheduledAt: "2026-08-01T12:00:00Z",
      }),
    ).toBe("scheduled");

    expect(
      resolveHqMembershipDisplayStatus({
        ...baseActive,
        nextScheduledAt: null,
      }),
    ).toBe("needs scheduling");
  });

  it("shows signed when card is captured but membership is still pending_payment", () => {
    expect(
      resolveHqMembershipDisplayStatus({
        status: "pending_payment",
        payment_setup_completed_at: null,
        stripe_payment_method_id: "pm_123",
      }),
    ).toBe("signed");
  });

  it("shows needs card when agreement is signed but no payment signal exists", () => {
    expect(
      resolveHqMembershipDisplayStatus({
        status: "pending_payment",
        payment_setup_completed_at: null,
        stripe_payment_method_id: null,
      }),
    ).toBe("needs card");
  });
});

describe("resolvePortalMembershipStatus", () => {
  it("matches strict active definition for portal profile status", () => {
    expect(
      resolvePortalMembershipStatus({
        status: "active",
        payment_setup_completed_at: "2026-01-01T00:00:00Z",
        agreement_id: "agreement-1",
        sales_tier: "quarterly",
        visit_price: 200,
      }),
    ).toBe("active");
    expect(
      resolvePortalMembershipStatus({
        status: "active",
        payment_setup_completed_at: null,
        stripe_payment_method_id: "pm_123",
      }),
    ).toBe("inactive");
  });
});

describe("scheduling and billing gates", () => {
  it("only allows schedule and bill for strict active memberships", () => {
    const active = {
      status: "active",
      payment_setup_completed_at: "2026-01-01T00:00:00Z",
      agreement_id: "agreement-1",
      sales_tier: "quarterly",
      visit_price: 200,
    };
    expect(canScheduleMembership(active)).toBe(true);
    expect(canBillMembership(active)).toBe(true);

    const cardOnly = {
      status: "pending_payment",
      payment_setup_completed_at: null,
      stripe_payment_method_id: "pm_123",
    };
    expect(canScheduleMembership(cardOnly)).toBe(false);
    expect(canBillMembership(cardOnly)).toBe(false);
  });
});

describe("hasPaymentSignal", () => {
  it("detects either completed setup or a saved payment method id", () => {
    expect(
      hasPaymentSignal({
        status: "pending_payment",
        payment_setup_completed_at: null,
        stripe_payment_method_id: "pm_123",
      }),
    ).toBe(true);
    expect(
      hasPaymentSignal({
        status: "pending_payment",
        payment_setup_completed_at: null,
        stripe_payment_method_id: null,
      }),
    ).toBe(false);
  });
});

describe("hasPaymentMethodOnFile", () => {
  it("is true only when payment_setup_completed_at is set", () => {
    expect(
      hasPaymentMethodOnFile({
        status: "active",
        payment_setup_completed_at: null,
        stripe_payment_method_id: "pm_123",
      }),
    ).toBe(false);
    expect(
      hasPaymentMethodOnFile({
        status: "active",
        payment_setup_completed_at: "2026-01-01T00:00:00Z",
      }),
    ).toBe(true);
  });
});

describe("isMembershipCancelled", () => {
  it("treats cancelled and paused as cancelled", () => {
    expect(isMembershipCancelled({ status: "cancelled" })).toBe(true);
    expect(isMembershipCancelled({ status: "paused" })).toBe(true);
    expect(isMembershipCancelled({ status: "active" })).toBe(false);
  });
});

describe("resolveStripePaymentStatus", () => {
  it("returns card_on_file when both stripe fields are set", () => {
    expect(
      resolveStripePaymentStatus({
        status: "active",
        payment_setup_completed_at: "2026-01-01T00:00:00Z",
        stripe_payment_method_id: "pm_123",
      }),
    ).toBe("card_on_file");
  });

  it("returns customer_only when only the Stripe customer exists", () => {
    expect(
      resolveStripePaymentStatus({
        status: "pending_payment",
        payment_setup_completed_at: null,
        stripe_customer_id: "cus_123",
      }),
    ).toBe("customer_only");
  });

  it("returns payment_pending for active/pending_payment memberships with no card", () => {
    expect(
      resolveStripePaymentStatus({
        status: "active",
        payment_setup_completed_at: null,
      }),
    ).toBe("payment_pending");
  });

  it("returns not_configured otherwise", () => {
    expect(
      resolveStripePaymentStatus({
        status: "inactive",
        payment_setup_completed_at: null,
      }),
    ).toBe("not_configured");
  });
});
