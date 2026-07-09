import {
  memberVsOneTimePremium,
  normalizeToSqueegeeKingTier,
  type SqueegeeKingTierId,
} from "@/lib/membership/tier-config";

/** Per-visit savings vs one-time retail when joining membership (sales law default). */
export function defaultEnrollmentSavingsForTier(
  tier: SqueegeeKingTierId | string,
): number {
  return memberVsOneTimePremium(normalizeToSqueegeeKingTier(tier));
}

export function resolveEnrollmentSavings(
  value: number | null | undefined,
  tier: SqueegeeKingTierId | string,
): number {
  if (typeof value === "number" && value > 0) {
    return Math.round(value * 100) / 100;
  }
  return defaultEnrollmentSavingsForTier(tier);
}

export function cumulativeMembershipEnrollmentSavings(
  enrollmentSavingsPerVisit: number,
  completedVisitCount: number,
): number {
  const visits = Math.max(0, Math.floor(completedVisitCount));
  return Math.round(enrollmentSavingsPerVisit * visits * 100) / 100;
}
