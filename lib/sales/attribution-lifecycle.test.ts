import { describe, expect, it } from "vitest";
import { resolveSalesAttributionLifecycle } from "./attribution-lifecycle";

const REFERENCE_DATE = new Date("2027-08-03T12:00:00.000Z");

describe("sales attribution lifecycle", () => {
  it("promotes a paid active membership without prematurely qualifying it", () => {
    expect(
      resolveSalesAttributionLifecycle({
        membershipStatus: "active",
        currentStatus: "pending",
        retentionQualifiesAt: "2027-08-04T00:00:00.000Z",
        referenceDate: REFERENCE_DATE,
      }),
    ).toEqual({ targetStatus: "active", qualifiesNow: false });
  });

  it("qualifies an active membership only after its retention date", () => {
    expect(
      resolveSalesAttributionLifecycle({
        membershipStatus: "active",
        currentStatus: "active",
        retentionQualifiesAt: "2027-08-03T11:59:59.000Z",
        referenceDate: REFERENCE_DATE,
      }),
    ).toEqual({ targetStatus: "qualified", qualifiesNow: true });
  });

  it("keeps an already-qualified active member qualified on retries", () => {
    expect(
      resolveSalesAttributionLifecycle({
        membershipStatus: "active",
        currentStatus: "qualified",
        retentionQualifiesAt: "2027-01-01T00:00:00.000Z",
        referenceDate: REFERENCE_DATE,
      }),
    ).toEqual({ targetStatus: "qualified", qualifiesNow: false });
  });

  it.each(["cancelled", "archived", "inactive"])(
    "makes %s membership state authoritative",
    (membershipStatus) => {
      expect(
        resolveSalesAttributionLifecycle({
          membershipStatus,
          currentStatus: "qualified",
          retentionQualifiesAt: "2027-01-01T00:00:00.000Z",
          referenceDate: REFERENCE_DATE,
        }),
      ).toEqual({ targetStatus: "cancelled", qualifiesNow: false });
    },
  );

  it("does not promote a membership that has not activated", () => {
    expect(
      resolveSalesAttributionLifecycle({
        membershipStatus: "pending_payment",
        currentStatus: "pending",
        retentionQualifiesAt: "2027-01-01T00:00:00.000Z",
        referenceDate: REFERENCE_DATE,
      }),
    ).toEqual({ targetStatus: "pending", qualifiesNow: false });
  });
});
