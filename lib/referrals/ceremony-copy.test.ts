import { describe, expect, it } from "vitest";
import {
  ceremonyCopy,
  dollarLabel,
  firstClaimableReward,
  preClaimCopy,
  settledRewardStatusLine,
} from "./ceremony-copy";
import type { PortalReferralRewardItem } from "./types";

function reward(
  overrides: Partial<PortalReferralRewardItem>,
): PortalReferralRewardItem {
  return {
    id: "r1",
    label: "$25 HomeAtlas Care Credit",
    status: "earned",
    earnedAt: "2026-07-17T00:00:00Z",
    valueCents: 2500,
    ...overrides,
  };
}

describe("dollarLabel", () => {
  it("formats whole dollars", () => {
    expect(dollarLabel(2500)).toBe("$25");
    expect(dollarLabel(10000)).toBe("$100");
  });
});

describe("firstClaimableReward", () => {
  it("returns the first earned care-credit reward", () => {
    const earned = reward({ id: "r2" });
    expect(
      firstClaimableReward([reward({ id: "r1", status: "available" }), earned]),
    ).toBe(earned);
  });

  it("skips percent rewards (manual redemption only)", () => {
    expect(
      firstClaimableReward([reward({ valueCents: null, label: "10% off" })]),
    ).toBeNull();
  });

  it("returns null when nothing is claimable", () => {
    expect(firstClaimableReward([reward({ status: "redeemed" })])).toBeNull();
    expect(firstClaimableReward([])).toBeNull();
  });
});

describe("preClaimCopy", () => {
  it("matches the approved invitation copy exactly", () => {
    expect(preClaimCopy(reward({}))).toEqual({
      eyebrow: "A thank-you is waiting.",
      headline: "$25 Care Credit unlocked.",
      support: "Another home you referred has joined the Care Network.",
      button: "Claim my reward",
    });
  });
});

describe("ceremonyCopy", () => {
  it("matches the approved ceremony copy exactly while billing is disabled", () => {
    expect(ceremonyCopy("Juanita", "$25 HomeAtlas Care Credit", false)).toEqual([
      "Congratulations, Juanita.",
      "Your $25 HomeAtlas Care Credit is ready.",
      "Thank you for welcoming another home into the Care Network.",
      "It is ready for your next eligible HomeAtlas care service.",
    ]);
  });

  it("uses the post-PR2 line only when credit application is ready", () => {
    expect(ceremonyCopy("Juanita", "$25 HomeAtlas Care Credit", true)[3]).toBe(
      "It will be applied toward your next eligible HomeAtlas charge.",
    );
  });

  it("never renders an empty name", () => {
    expect(ceremonyCopy("  ", "$25 HomeAtlas Care Credit", false)[0]).toBe(
      "Congratulations, friend.",
    );
  });
});

describe("settledRewardStatusLine", () => {
  it("matches the approved settled copy", () => {
    expect(settledRewardStatusLine()).toBe(
      "Claimed · Ready for your next eligible service",
    );
  });
});
