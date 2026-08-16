import { describe, expect, it } from "vitest";
import {
  SALES_DOOR_DISPOSITIONS,
  normalizeSalesDoorAddress,
  normalizeSalesDoorAddressKey,
  salesDoorDispositionCountsConversation,
  salesDoorDispositionLabel,
} from "./door-memory";

describe("sales door memory", () => {
  it("keeps a readable address while producing a stable comparison key", () => {
    expect(normalizeSalesDoorAddress("  1420   Davis St.  ")).toBe(
      "1420 Davis St.",
    );
    expect(normalizeSalesDoorAddressKey("1420 Davis St., Chico CA")).toBe(
      "1420 davis st chico ca",
    );
    expect(normalizeSalesDoorAddressKey(" 1420 DAVIS ST — Chico, CA ")).toBe(
      "1420 davis st chico ca",
    );
  });

  it("uses clear, field-readable outcome labels", () => {
    expect(salesDoorDispositionLabel("not_home")).toBe("No answer");
    expect(salesDoorDispositionLabel("do_not_knock")).toBe("Do not knock");
  });

  it("counts exactly the doorstep outcomes that prove a conversation", () => {
    expect(
      Object.fromEntries(
        SALES_DOOR_DISPOSITIONS.map((disposition) => [
          disposition,
          salesDoorDispositionCountsConversation(disposition),
        ]),
      ),
    ).toEqual({
      not_home: false,
      conversation: true,
      follow_up: true,
      interested: true,
      not_interested: false,
      do_not_knock: false,
    });
  });
});
