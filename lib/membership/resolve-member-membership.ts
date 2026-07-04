import type { HomeCarePlanData } from "@/lib/home-care-plan/types";
import {
  buildMemberAnnualSchedule,
  type MemberScheduleView,
} from "./member-schedule";
import {
  calculateMembershipPrice,
  inferMembershipTierId,
  MEMBERSHIP_TIERS,
  summarizeMembershipValue,
  type MembershipTierId,
  type MembershipValueSummary,
} from "./tier-config";

export interface MemberMembershipView {
  tier: MembershipTierId;
  tierName: string;
  tierTagline: string;
  memberName: string;
  memberSince: string;
  memberSinceLabel: string;
  squareFootage: number;
  monthlyPrice: number;
  value: MembershipValueSummary;
  schedule: MemberScheduleView;
  priorityBooking: boolean;
  dedicatedTech: boolean;
  homeReportCard: boolean;
}

function resolveSquareFootage(data: HomeCarePlanData): number {
  const sqftRow = data.propertyProfile.find((row) =>
    /sq\.?\s*ft|square\s*feet/i.test(row.label),
  );
  if (sqftRow?.value) {
    const parsed = parseInt(sqftRow.value.replace(/\D/g, ""), 10);
    if (parsed > 0) return parsed;
  }
  return 2500;
}

function resolveMemberSince(data: HomeCarePlanData): Date {
  if (data.homeowner.slug === "larry-buckley") {
    return new Date("2024-03-01");
  }
  return new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
}

function formatMemberSince(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function memberSinceDuration(date: Date, reference = new Date()): string {
  const months =
    (reference.getFullYear() - date.getFullYear()) * 12 +
    (reference.getMonth() - date.getMonth());
  if (months < 12) return `${Math.max(1, months)} months`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) return `${years} year${years === 1 ? "" : "s"}`;
  return `${years} yr · ${rem} mo`;
}

export function resolveMemberMembershipView(
  data: HomeCarePlanData,
  options?: { planName?: string; referenceDate?: Date },
): MemberMembershipView {
  const planName =
    options?.planName?.trim() ||
    data.property.membershipRecommendation ||
    data.memberships.find((t) => t.highlighted)?.name ||
    data.memberships[0]?.name ||
    "Premium";

  const tier = inferMembershipTierId(planName);
  const tierDef = MEMBERSHIP_TIERS[tier];
  const squareFootage = resolveSquareFootage(data);
  const monthlyPrice = calculateMembershipPrice(tier, squareFootage);
  const value = summarizeMembershipValue(tier, squareFootage);
  const memberSince = resolveMemberSince(data);

  const schedule = buildMemberAnnualSchedule({
    tier,
    monthlyPrice,
    referenceDate: options?.referenceDate,
    dedicatedTech: tierDef.dedicatedTech ? "Marcus" : null,
  });

  return {
    tier,
    tierName: tierDef.name,
    tierTagline: tierDef.tagline,
    memberName: data.homeowner.fullName,
    memberSince: memberSince.toISOString(),
    memberSinceLabel: memberSinceDuration(memberSince, options?.referenceDate),
    squareFootage,
    monthlyPrice,
    value,
    schedule,
    priorityBooking: tierDef.priorityBooking,
    dedicatedTech: tierDef.dedicatedTech,
    homeReportCard: tierDef.homeReportCard,
  };
}
