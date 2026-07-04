import type { HomeCarePlanData } from "@/lib/home-care-plan/types";
import type { MemberPortalData } from "@/lib/persistence/queries/member-portal";
import { ADDON_DISCOUNT_FINE_PRINT } from "./tier-config";
import type { MemberPortalStatus } from "./member-portal-status";
import type { MemberMembershipView } from "./resolve-member-membership";

export interface PropertyHealthScore {
  label: string;
  percent: number;
}

export interface MemberHomeDashboardView {
  memberFirstName: string;
  propertyName: string;
  squareFootage: number;
  planLabel: string;
  lastVisitLabel: string;
  nextVisitLabel: string;
  propertyHealth: PropertyHealthScore[];
  addOnDiscountPercent: number | null;
  discountFinePrint: string;
  bookAddOnHref: string;
  viewHistoryHref: string;
  agreementHref: string;
}

function parseFlexibleDate(value: string): Date | null {
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const withYear = new Date(`${value}, ${new Date().getFullYear()}`);
  if (!Number.isNaN(withYear.getTime())) return withYear;

  return null;
}

function daysBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export function formatLastVisitRelative(
  date: Date | null,
  reference = new Date(),
): string {
  if (!date) return "No visits yet";
  const days = daysBetween(date, reference);
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function formatNextVisitScheduled(
  value: string | null,
  reference = new Date(),
): string {
  if (!value?.trim()) return "Not scheduled yet";

  const parsed = parseFlexibleDate(value);
  if (!parsed) return value;

  const monthDay = parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });

  if (parsed < reference) {
    return `Was scheduled ${monthDay}`;
  }

  return `Scheduled ${monthDay}`;
}

export function resolvePropertyHealthScores(
  data: HomeCarePlanData,
): PropertyHealthScore[] {
  const base = data.property.homeCareScore ?? 85;
  const findings = data.findings ?? [];

  const hardWater = findings.some(
    (f) =>
      f.id === "hard-water" ||
      f.title.toLowerCase().includes("hard water") ||
      f.title.toLowerCase().includes("mineral"),
  );
  const frameWear = findings.some(
    (f) =>
      f.title.toLowerCase().includes("frame") ||
      f.title.toLowerCase().includes("window") ||
      f.title.toLowerCase().includes("seal"),
  );

  const glass = Math.min(98, Math.max(55, base - (hardWater ? 9 : 4)));
  const frames = Math.min(95, Math.max(50, base - (frameWear ? 17 : 10)));

  return [
    { label: "Glass", percent: glass },
    { label: "Frames", percent: frames },
  ];
}

function resolveLastVisitDate(
  data: HomeCarePlanData,
  portalData: MemberPortalData | null | undefined,
  careStatus: MemberPortalStatus,
): Date | null {
  if (portalData?.appointments?.length) {
    const completed = portalData.appointments
      .filter((a) => a.status === "completed")
      .map((a) => parseFlexibleDate(a.date))
      .filter((d): d is Date => d !== null)
      .sort((a, b) => b.getTime() - a.getTime());

    if (completed[0]) return completed[0];
  }

  if (careStatus.lastVisit) {
    return parseFlexibleDate(careStatus.lastVisit);
  }

  if (data.property.lastVisit) {
    return parseFlexibleDate(data.property.lastVisit);
  }

  return null;
}

function resolveNextVisitLabel(
  careStatus: MemberPortalStatus,
  membership: MemberMembershipView,
): string {
  if (membership.schedule.nextVisit?.scheduledDate) {
    return formatNextVisitScheduled(membership.schedule.nextVisit.scheduledDate);
  }
  if (careStatus.nextVisit) {
    return formatNextVisitScheduled(careStatus.nextVisit);
  }
  return "Not scheduled yet";
}

export function buildMemberHomeDashboardView(
  data: HomeCarePlanData,
  careStatus: MemberPortalStatus,
  membership: MemberMembershipView,
  options: {
    portalData?: MemberPortalData | null;
    planPath: string;
    referenceDate?: Date;
  },
): MemberHomeDashboardView {
  const reference = options.referenceDate ?? new Date();
  const lastVisitDate = resolveLastVisitDate(
    data,
    options.portalData,
    careStatus,
  );

  return {
    memberFirstName:
      options.portalData?.profile.firstName ?? data.homeowner.firstName,
    propertyName: data.property.name,
    squareFootage: membership.squareFootage,
    planLabel: `${careStatus.cadenceLabel} Plan`,
    lastVisitLabel: formatLastVisitRelative(lastVisitDate, reference),
    nextVisitLabel: resolveNextVisitLabel(careStatus, membership),
    propertyHealth: resolvePropertyHealthScores(data),
    addOnDiscountPercent: careStatus.addOnDiscountPercent,
    discountFinePrint: "Active while payments current",
    bookAddOnHref: "#member-addons",
    viewHistoryHref: `${options.planPath}#journey`,
    agreementHref: `${options.planPath}#join`,
  };
}

export function memberAddOnDiscountNote(percent: number | null): string | null {
  if (percent == null) return null;
  return `${percent}% off all add-ons`;
}

export { ADDON_DISCOUNT_FINE_PRINT };
