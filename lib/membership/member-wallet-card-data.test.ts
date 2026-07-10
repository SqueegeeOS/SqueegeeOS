import { describe, expect, it } from "vitest";
import {
  buildMemberWalletCardData,
  isMemberMembershipActive,
} from "./member-wallet-card-data";
import type { MemberPortalStatus } from "./member-portal-status";
import type { MemberMembershipView } from "./resolve-member-membership";

const membership: MemberMembershipView = {
  tier: "premium",
  tierName: "Premium",
  tierTagline: "Total Protection",
  memberName: "Sarah Mitchell",
  memberSince: "2026-03-15T12:00:00.000Z",
  memberSinceLabel: "3 months",
  squareFootage: 2500,
  monthlyPrice: 249,
  value: {
    narrative: "savings",
    annualDelta: -200,
    certaintyCopy: "",
  },
  schedule: {
    items: [],
    completedCount: 0,
    nextVisit: null,
    ytdSavings: null,
  },
  priorityBooking: true,
  dedicatedTech: false,
  homeReportCard: true,
};

const careStatus: MemberPortalStatus = {
  planName: "Preferred Care",
  cadence: "quarterly",
  cadenceLabel: "Quarterly",
  serviceSummary: "Quarterly care",
  lastVisit: null,
  lastVisitService: null,
  nextVisit: null,
  addOnDiscountPercent: 25,
  addOns: [],
  scheduleVisitHref: "/contact",
};

describe("member wallet card", () => {
  it("builds wallet labels from membership and cadence", () => {
    const card = buildMemberWalletCardData(membership, careStatus);
    expect(card.memberName).toBe("Sarah Mitchell");
    expect(card.tierLabel).toBe("Quarterly Member");
    expect(card.addonDiscountLabel).toBe("25% off add-ons");
    expect(card.addonDiscountPercent).toBe(25);
    expect(card.memberSinceLabel).toMatch(/Member since March 2026/);
    expect(card.brandName).toBe("HomeAtlas");
  });

  it("returns false without live portal membership data", () => {
    expect(isMemberMembershipActive(null)).toBe(false);
    expect(isMemberMembershipActive(undefined)).toBe(false);
  });

  it("hides card when membership is not active", () => {
    expect(
      isMemberMembershipActive({
        membershipStatus: "inactive",
        paymentSetupCompletedAt: null,
      } as never),
    ).toBe(false);
    expect(
      isMemberMembershipActive({
        membershipStatus: "active",
        paymentSetupCompletedAt: "2026-01-01T00:00:00Z",
      } as never),
    ).toBe(true);
  });
});
