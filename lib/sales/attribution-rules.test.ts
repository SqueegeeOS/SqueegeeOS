import { describe, expect, it } from "vitest";
import {
  annualRateToCents,
  membershipStatusToAttributionStatus,
} from "./attribution-rules";

describe("automatic sales attribution rules", () => {
  it("snapshots authoritative membership ARR in integer cents", () => {
    expect(annualRateToCents(1200)).toBe(120_000);
    expect(annualRateToCents("1499.99")).toBe(149_999);
    expect(() => annualRateToCents(-1)).toThrow(/annual rate is invalid/i);
  });

  it("starts signature credit at the membership lifecycle state", () => {
    expect(membershipStatusToAttributionStatus("active")).toBe("active");
    expect(membershipStatusToAttributionStatus("cancelled")).toBe("cancelled");
    expect(membershipStatusToAttributionStatus("archived")).toBe("cancelled");
    expect(membershipStatusToAttributionStatus("pending_payment")).toBe(
      "pending",
    );
  });
});
