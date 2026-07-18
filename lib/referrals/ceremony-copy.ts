import type { PortalReferralRewardItem } from "./types";

/** Dollar label for a cent value: 2500 -> "$25". */
export function dollarLabel(valueCents: number): string {
  return `$${(valueCents / 100).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}`;
}

/** The first claimable (earned care-credit) reward, oldest milestone first. */
export function firstClaimableReward(
  rewards: PortalReferralRewardItem[],
): PortalReferralRewardItem | null {
  return rewards.find((r) => r.status === "earned" && r.valueCents !== null) ?? null;
}

/** Pre-claim invitation copy. */
export function preClaimCopy(reward: PortalReferralRewardItem): {
  eyebrow: string;
  headline: string;
  support: string;
  button: string;
} {
  return {
    eyebrow: "A thank-you is waiting.",
    headline: `${dollarLabel(reward.valueCents ?? 0)} Care Credit unlocked.`,
    support: "Another home you referred has joined the Care Network.",
    button: "Claim my reward",
  };
}

/**
 * Ceremony confirmation lines. Identical for animated, reduced-motion, and
 * screen-reader presentations — the ceremony is styling, never information.
 * The final line changes only when PR2's billing allocator ships.
 */
export function ceremonyCopy(
  firstName: string,
  rewardLabel: string,
  creditApplicationReady: boolean,
): string[] {
  const greetingName = firstName.trim() || "friend";
  return [
    `Congratulations, ${greetingName}.`,
    `Your ${rewardLabel} is ready.`,
    "Thank you for welcoming another home into the Care Network.",
    creditApplicationReady
      ? "It will be applied toward your next eligible HomeAtlas charge."
      : "It is ready for your next eligible HomeAtlas care service.",
  ];
}

/** Settled reward line, e.g. "Claimed · Ready for your next eligible service". */
export function settledRewardStatusLine(): string {
  return "Claimed · Ready for your next eligible service";
}
