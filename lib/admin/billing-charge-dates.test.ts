import { describe, expect, it } from "vitest";
import {
  chargeDateForServiceWindow,
  deriveBillingStatus,
  resolveNextChargeDate,
} from "./billing-charge-dates";

describe("chargeDateForServiceWindow", () => {
  it("returns the 1st of the service month", () => {
    expect(chargeDateForServiceWindow("2026-07-15")).toBe("2026-07-01");
    expect(chargeDateForServiceWindow("2026-10-02")).toBe("2026-10-01");
  });
});

describe("resolveNextChargeDate", () => {
  it("uses the earliest open obligation window", () => {
    const next = resolveNextChargeDate(
      [
        { targetWindowStart: "2026-07-10", status: "promised" },
        { targetWindowStart: "2026-10-05", status: "promised" },
      ],
      new Date("2026-07-09T12:00:00.000Z"),
    );
    expect(next).toBe("2026-07-01");
  });

  it("skips completed obligations", () => {
    const next = resolveNextChargeDate(
      [
        { targetWindowStart: "2026-04-10", status: "completed" },
        { targetWindowStart: "2026-10-05", status: "promised" },
      ],
      new Date("2026-07-09T12:00:00.000Z"),
    );
    expect(next).toBe("2026-10-01");
  });
});

describe("deriveBillingStatus", () => {
  it("marks active members in the current service month as ready", () => {
    expect(
      deriveBillingStatus({
        membershipActive: true,
        paymentOnFile: true,
        nextChargeDate: "2026-07-01",
        latestChargeStatus: null,
        referenceDate: new Date("2026-07-09T12:00:00.000Z"),
      }),
    ).toBe("ready_to_charge");
  });

  it("marks future months as upcoming", () => {
    expect(
      deriveBillingStatus({
        membershipActive: true,
        paymentOnFile: true,
        nextChargeDate: "2026-10-01",
        latestChargeStatus: null,
        referenceDate: new Date("2026-07-09T12:00:00.000Z"),
      }),
    ).toBe("upcoming");
  });
});
