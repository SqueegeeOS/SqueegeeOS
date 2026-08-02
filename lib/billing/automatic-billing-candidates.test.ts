import { describe, expect, it } from "vitest";
import { shouldVoidOrderMissingFromScheduledVisits } from "./automatic-billing-candidates";

const order = {
  appointment_id: "appointment-1",
  preview_state: "locked",
  execution_state: "pending",
  stripe_payment_intent_id: null,
};

describe("automatic billing stale-order protection", () => {
  it("voids an unstarted order when Jobber no longer reports its visit", () => {
    expect(
      shouldVoidOrderMissingFromScheduledVisits(order, new Set()),
    ).toBe(true);
  });

  it("keeps the order when the exact scheduled visit remains", () => {
    expect(
      shouldVoidOrderMissingFromScheduledVisits(
        order,
        new Set(["appointment-1"]),
      ),
    ).toBe(false);
  });

  it("never voids an already succeeded order during schedule cleanup", () => {
    expect(
      shouldVoidOrderMissingFromScheduledVisits(
        { ...order, execution_state: "succeeded" },
        new Set(),
      ),
    ).toBe(false);
  });

  it("keeps provider-contacted orders visible for reconciliation", () => {
    for (const executionState of [
      "processing",
      "failed_retryable",
      "needs_action",
      "permanently_failed",
      "reconciliation_required",
    ]) {
      expect(
        shouldVoidOrderMissingFromScheduledVisits(
          { ...order, execution_state: executionState },
          new Set(),
        ),
      ).toBe(false);
    }

    expect(
      shouldVoidOrderMissingFromScheduledVisits(
        { ...order, stripe_payment_intent_id: "pi_in_flight" },
        new Set(),
      ),
    ).toBe(false);
  });
});
