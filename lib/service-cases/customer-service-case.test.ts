import { describe, expect, it } from "vitest";
import {
  customerServiceCaseAnchorId,
  isCustomerServiceCaseAction,
  isCustomerServiceCaseCategory,
  isUuid,
} from "./customer-service-case";

describe("customer service case contracts", () => {
  it("accepts only supported categories and operator actions", () => {
    expect(isCustomerServiceCaseCategory("service_quality")).toBe(true);
    expect(isCustomerServiceCaseCategory("membership_cancellation")).toBe(true);
    expect(isCustomerServiceCaseCategory("refund_everything")).toBe(false);
    expect(isCustomerServiceCaseAction("acknowledge")).toBe(true);
    expect(isCustomerServiceCaseAction("send_text")).toBe(false);
  });

  it("requires a real UUID for case and idempotency identifiers", () => {
    expect(isUuid("11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(isUuid("membership-1")).toBe(false);
  });

  it("builds a fragment-safe exact HQ anchor", () => {
    expect(
      customerServiceCaseAnchorId(
        "11111111-1111-4111-8111-111111111111<script>",
      ),
    ).toBe("service-case-11111111-1111-4111-8111-111111111111-script");
  });
});
