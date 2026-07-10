import { describe, expect, it } from "vitest";
import {
  isMembershipActive,
  resolveMembershipLifecycle,
} from "./membership-lifecycle-resolver";

describe("resolveMembershipLifecycle", () => {
  it("returns active for a fully activated membership", () => {
    const result = resolveMembershipLifecycle({
      status: "active",
      payment_setup_completed_at: "2026-01-02T00:00:00Z",
      agreement_id: "agr-1",
      sales_tier: "biannual",
      visit_price: 450,
      visits_per_year: 2,
      signedAgreementStatus: "complete",
    });

    expect(result.state).toBe("active");
    expect(result.isActive).toBe(true);
    expect(result.canSchedule).toBe(true);
    expect(result.inconsistencies).toEqual([]);
  });

  it("returns payment_pending after sign without card", () => {
    const result = resolveMembershipLifecycle({
      status: "pending_payment",
      agreement_id: "agr-1",
      signedAgreementStatus: "complete",
      sales_tier: "biannual",
      visit_price: 450,
    });

    expect(result.state).toBe("payment_pending");
    expect(result.isActive).toBe(false);
  });

  it("returns activation_pending when card signal exists but status is not active", () => {
    const result = resolveMembershipLifecycle({
      status: "pending_payment",
      stripe_payment_method_id: "pm_123",
      agreement_id: "agr-1",
      signedAgreementStatus: "complete",
      sales_tier: "biannual",
      visit_price: 450,
    });

    expect(result.state).toBe("activation_pending");
    expect(result.isActive).toBe(false);
  });

  it("flags inconsistent when status is active without payment completion", () => {
    const result = resolveMembershipLifecycle({
      status: "active",
      payment_setup_completed_at: null,
      agreement_id: "agr-1",
      sales_tier: "biannual",
      visit_price: 450,
    });

    expect(result.state).toBe("inconsistent");
    expect(result.inconsistencies).toContain(
      "status_active_without_payment_setup_completed_at",
    );
  });

  it("returns canceled for cancelled memberships", () => {
    const result = resolveMembershipLifecycle({
      status: "cancelled",
      payment_setup_completed_at: "2026-01-01T00:00:00Z",
    });

    expect(result.state).toBe("canceled");
  });

  it("returns past_due only when active and pastDue is set", () => {
    const base = {
      status: "active",
      payment_setup_completed_at: "2026-01-02T00:00:00Z",
      agreement_id: "agr-1",
      sales_tier: "biannual",
      visit_price: 450,
    };

    expect(resolveMembershipLifecycle({ ...base, pastDue: true }).state).toBe(
      "past_due",
    );
    expect(resolveMembershipLifecycle({ ...base, pastDue: false }).state).toBe(
      "active",
    );
  });
});

describe("isMembershipActive strict fields", () => {
  it("allows partial input when agreement fields are omitted", () => {
    expect(
      isMembershipActive({
        status: "active",
        payment_setup_completed_at: "2026-01-01T00:00:00Z",
      }),
    ).toBe(true);
  });

  it("fails when agreement_id is explicitly null on an active row", () => {
    expect(
      isMembershipActive({
        status: "active",
        payment_setup_completed_at: "2026-01-01T00:00:00Z",
        agreement_id: null,
      }),
    ).toBe(false);
  });
});
