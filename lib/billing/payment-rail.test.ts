import { describe, expect, it } from "vitest";
import {
  isManualPaymentRail,
  isPaymentRail,
  normalizePaymentRail,
  paymentRailLabel,
} from "./payment-rail";

describe("payment rail", () => {
  it("defaults unknown values to the safe Stripe rail", () => {
    expect(normalizePaymentRail("cash")).toBe("stripe_card");
    expect(isPaymentRail("cash")).toBe(false);
  });

  it("identifies the owner-approved manual rail without calling it paid", () => {
    expect(isManualPaymentRail("manual_cash_check")).toBe(true);
    expect(paymentRailLabel("manual_cash_check")).toBe("Cash or check account");
  });
});
