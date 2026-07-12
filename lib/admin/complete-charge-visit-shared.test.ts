import { describe, expect, it } from "vitest";
import {
  calculateVisitChargeTotals,
  validateCompleteChargeVisitInput,
  visitChargeOperationKey,
  type CompleteChargeVisitInput,
} from "./complete-charge-visit-shared";

const sylviaVisit: CompleteChargeVisitInput = {
  membershipId: "membership-sylvia",
  appointmentId: "appointment-sylvia-2026-07",
  serviceDate: "2026-07-11",
  lines: [
    {
      id: "windows",
      kind: "membership_visit",
      serviceName: "Window cleaning",
      retailPrice: 400,
      amountCharged: 300,
    },
    {
      id: "roof",
      kind: "addon_service",
      serviceName: "Roof treatment",
      retailPrice: 375,
      amountCharged: 300,
    },
  ],
};

describe("complete and charge visit", () => {
  it("calculates Sylvia's $600 charge and $175 savings", () => {
    expect(calculateVisitChargeTotals(sylviaVisit.lines)).toEqual({
      retailTotalCents: 77_500,
      chargeTotalCents: 60_000,
      savingsTotalCents: 17_500,
    });
    expect(validateCompleteChargeVisitInput(sylviaVisit)).toBeNull();
  });

  it("uses the appointment as the stable duplicate-prevention key", () => {
    expect(visitChargeOperationKey(sylviaVisit)).toBe(
      "visit:membership-sylvia:appointment-sylvia-2026-07",
    );
  });

  it("rejects membership visits without an appointment", () => {
    expect(
      validateCompleteChargeVisitInput({
        ...sylviaVisit,
        appointmentId: undefined,
      }),
    ).toBe("A membership visit requires a scheduled appointment.");
  });

  it("rejects charges above retail value", () => {
    expect(
      validateCompleteChargeVisitInput({
        ...sylviaVisit,
        lines: [{ ...sylviaVisit.lines[0]!, amountCharged: 401 }],
      }),
    ).toBe("A charged amount cannot exceed its retail value.");
  });

  it("rejects duplicate service line IDs", () => {
    expect(
      validateCompleteChargeVisitInput({
        ...sylviaVisit,
        lines: [sylviaVisit.lines[0]!, { ...sylviaVisit.lines[1]!, id: "windows" }],
      }),
    ).toBe("Every service requires a unique line ID.");
  });
});
