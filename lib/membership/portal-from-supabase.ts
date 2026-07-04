import type { MemberPortalData } from "@/lib/persistence/queries/member-portal";
import type { HomeCarePlanData } from "@/lib/home-care-plan/types";
import type { MemberPortalStatus } from "./member-portal-status";
import {
  inferMembershipCadence,
  MEMBER_ADD_ON_CATALOG,
  MEMBER_ADD_ON_DISCOUNT,
  memberPriceAfterDiscount,
  buildMemberContactHref,
  SERVICE_SUMMARY,
  CADENCE_LABEL,
} from "./member-portal-status";
import { resolveMemberPortalStatus } from "./member-portal-status";
import type { MemberMembershipView } from "./resolve-member-membership";
import { resolveMemberMembershipView } from "./resolve-member-membership";
import {
  calculateMembershipPrice,
  inferMembershipTierId,
  MEMBERSHIP_TIERS,
  summarizeMembershipValue,
} from "./tier-config";
import {
  buildScheduleFromAppointments,
  type MemberScheduleView,
} from "./member-schedule";
import { formatServiceTypeLabel } from "./service-labels";
import { buildMemberSavingsSummary } from "./member-savings-tracker";

function formatVisitDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatVisitDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function memberSinceDuration(startIso: string, reference = new Date()): string {
  const start = new Date(startIso);
  const months =
    (reference.getFullYear() - start.getFullYear()) * 12 +
    (reference.getMonth() - start.getMonth());
  if (months < 12) return `${Math.max(1, months)} months`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) return `${years} year${years === 1 ? "" : "s"}`;
  return `${years} yr · ${rem} mo`;
}

function resolveSquareFootage(
  data: HomeCarePlanData,
  portalData: MemberPortalData,
): number {
  if (portalData.property.details.squareFootage) {
    return portalData.property.details.squareFootage;
  }
  const sqftRow = data.propertyProfile.find((row) =>
    /sq\.?\s*ft|square\s*feet/i.test(row.label),
  );
  if (sqftRow?.value) {
    const parsed = parseInt(sqftRow.value.replace(/\D/g, ""), 10);
    if (parsed > 0) return parsed;
  }
  return 2500;
}

export function buildPortalStatusFromSupabase(
  data: HomeCarePlanData,
  portalData: MemberPortalData,
): MemberPortalStatus {
  const planName = portalData.membershipPlanName;
  const cadence = inferMembershipCadence(planName);
  const discountPercent = MEMBER_ADD_ON_DISCOUNT[cadence] ?? null;

  const completed = [...portalData.appointments]
    .filter((a) => a.status === "completed")
    .sort((a, b) => b.date.localeCompare(a.date));

  const lastCompleted = completed[0] ?? null;

  const addOns = MEMBER_ADD_ON_CATALOG.map((addon) => ({
    ...addon,
    memberPrice: memberPriceAfterDiscount(addon.listPrice, discountPercent),
  }));

  return {
    planName,
    cadence,
    cadenceLabel: CADENCE_LABEL[cadence],
    serviceSummary: SERVICE_SUMMARY[cadence],
    lastVisit: lastCompleted ? formatVisitDate(lastCompleted.date) : null,
    lastVisitService: lastCompleted
      ? formatServiceTypeLabel(lastCompleted.serviceType)
      : null,
    nextVisit: portalData.nextAppointment
      ? formatVisitDateLong(portalData.nextAppointment.date)
      : null,
    addOnDiscountPercent: discountPercent,
    addOns,
    scheduleVisitHref: buildMemberContactHref(
      "schedule-visit",
      data.property.slug,
    ),
  };
}

export function buildMembershipViewFromSupabase(
  data: HomeCarePlanData,
  portalData: MemberPortalData,
  referenceDate = new Date(),
): MemberMembershipView {
  const planName = portalData.membershipPlanName;
  const tier = inferMembershipTierId(planName);
  const tierDef = MEMBERSHIP_TIERS[tier];
  const squareFootage = resolveSquareFootage(data, portalData);
  const monthlyPrice =
    portalData.monthlyRate > 0
      ? portalData.monthlyRate
      : calculateMembershipPrice(tier, squareFootage);
  const value = summarizeMembershipValue(tier, squareFootage);
  const memberSince =
    portalData.memberSince ??
    portalData.profile.memberSince ??
    new Date().toISOString();

  const scheduleBase: MemberScheduleView = buildScheduleFromAppointments({
    appointments: portalData.appointments,
    monthlyPrice,
    referenceDate,
    ytdSavings: portalData.ytdSavings.savings,
  });

  const membershipDraft: MemberMembershipView = {
    tier,
    tierName: tierDef.name,
    tierTagline: tierDef.tagline,
    memberName: data.homeowner.fullName,
    memberSince,
    memberSinceLabel: memberSinceDuration(memberSince, referenceDate),
    squareFootage,
    monthlyPrice,
    value,
    schedule: scheduleBase,
    priorityBooking: tierDef.priorityBooking,
    dedicatedTech: tierDef.dedicatedTech,
    homeReportCard: tierDef.homeReportCard,
  };

  const savings = buildMemberSavingsSummary(membershipDraft, portalData, referenceDate);

  return {
    ...membershipDraft,
    schedule: {
      ...scheduleBase,
      ytdSavings: savings.savedThisYear,
      totalSaved: savings.totalSaved,
    },
  };
}

export function resolvePortalViews(
  data: HomeCarePlanData,
  portalData: MemberPortalData | null | undefined,
  options?: { planName?: string; referenceDate?: Date },
): {
  status: MemberPortalStatus;
  membership: MemberMembershipView;
  liveData: boolean;
} {
  if (portalData?.profile) {
    return {
      status: buildPortalStatusFromSupabase(data, portalData),
      membership: buildMembershipViewFromSupabase(
        data,
        portalData,
        options?.referenceDate,
      ),
      liveData: true,
    };
  }

  return {
    status: resolveMemberPortalStatus(data, options),
    membership: resolveMemberMembershipView(data, options),
    liveData: false,
  };
}
