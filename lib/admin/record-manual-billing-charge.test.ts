import { describe, expect, it } from "vitest";
import {
  billingPeriodFromChargeDate,
  isPaidBillingStatus,
} from "./billing-ledger";
import { validateRecordManualBillingChargeInput } from "./record-manual-billing-charge";

describe("isPaidBillingStatus", () => {
  it("treats paid and charged as collected", () => {
    expect(isPaidBillingStatus("paid")).toBe(true);
    expect(isPaidBillingStatus("charged")).toBe(true);
    expect(isPaidBillingStatus("pending")).toBe(false);
  });
});

describe("billingPeriodFromChargeDate", () => {
  it("normalizes to the 1st of the month", () => {
    expect(billingPeriodFromChargeDate("2026-07-09")).toBe("2026-07-01");
  });
});

describe("validateRecordManualBillingChargeInput", () => {
  it("requires membership, amount, and date", () => {
    expect(
      validateRecordManualBillingChargeInput({
        membershipId: "",
        amount: 100,
        chargeDate: "2026-07-09",
      }),
    ).toContain("Membership");
    expect(
      validateRecordManualBillingChargeInput({
        membershipId: "abc",
        amount: -1,
        chargeDate: "2026-07-09",
      }),
    ).toContain("amount");
    expect(
      validateRecordManualBillingChargeInput({
        membershipId: "abc",
        amount: 100,
        chargeDate: "bad",
        stripeReference: "pi_valid",
      }),
    ).toContain("Charge date");
  });

  it("requires proof of an external Stripe payment", () => {
    expect(
      validateRecordManualBillingChargeInput({
        membershipId: "abc",
        amount: 10,
        chargeDate: "2026-07-11",
      }),
    ).toContain("Stripe");
    expect(
      validateRecordManualBillingChargeInput({
        membershipId: "abc",
        amount: 10,
        chargeDate: "2026-07-11",
        stripeReference: "pi_123abc",
      }),
    ).toBeNull();
  });
});
