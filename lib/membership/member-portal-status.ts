import { ROUTES } from "@/lib/navigation/config";
import { propertyHubContext } from "@/lib/property/mock-data";
import { getPropertyBySlug } from "@/lib/property/types";
import type { HomeCarePlanData } from "@/lib/home-care-plan/types";

export type MembershipCadence = "quarterly" | "bi-annual" | "monthly" | "one-time";

export interface MemberAddOnService {
  id: string;
  name: string;
  description: string;
  listPrice: number;
}

export interface MemberPortalStatus {
  planName: string;
  cadence: MembershipCadence;
  cadenceLabel: string;
  serviceSummary: string;
  lastVisit: string | null;
  lastVisitService: string | null;
  nextVisit: string | null;
  addOnDiscountPercent: number | null;
  addOns: Array<MemberAddOnService & { memberPrice: number | null }>;
  scheduleVisitHref: string;
}

const CADENCE_LABEL: Record<MembershipCadence, string> = {
  quarterly: "Quarterly",
  "bi-annual": "Bi-Annual",
  monthly: "Monthly",
  "one-time": "One-Time",
};

const SERVICE_SUMMARY: Record<MembershipCadence, string> = {
  quarterly:
    "Quarterly exterior stewardship — windows, tracks, gutters, and a full property walkthrough each season.",
  "bi-annual":
    "Bi-annual exterior care — scheduled inspection, documented report, and seasonal refresh twice per year.",
  monthly:
    "Monthly wellness visits — continuous stewardship with concierge scheduling and priority response.",
  "one-time": "Single-visit exterior refresh — not a recurring membership.",
};

/** Member add-on discount by cadence (percent off list price). */
export const MEMBER_ADD_ON_DISCOUNT: Partial<Record<MembershipCadence, number>> = {
  quarterly: 25,
  "bi-annual": 20,
};

export const MEMBER_ADD_ON_CATALOG: MemberAddOnService[] = [
  {
    id: "rainblock",
    name: "RainBlock Treatment",
    description: "Standalone glass protection between scheduled visits.",
    listPrice: 120,
  },
  {
    id: "hard-water",
    name: "Hard Water Removal",
    description: "Mineral buildup treatment for south-facing glass and fixtures.",
    listPrice: 165,
  },
  {
    id: "gutter-deep",
    name: "Gutter Deep Clean",
    description: "Full gutter flush and downspout check outside your regular visit.",
    listPrice: 180,
  },
  {
    id: "screen-track",
    name: "Screen & Track Detailing",
    description: "Screens removed, tracks cleared, hardware inspected.",
    listPrice: 145,
  },
];

export function inferMembershipCadence(planName: string): MembershipCadence {
  const normalized = planName.toLowerCase();
  if (normalized.includes("essential")) return "bi-annual";
  if (normalized.includes("estate")) return "monthly";
  if (normalized.includes("one-time") || normalized.includes("one time")) {
    return "one-time";
  }
  if (normalized.includes("preferred")) return "quarterly";
  if (normalized.includes("quarter")) return "quarterly";
  if (normalized.includes("bi-annual") || normalized.includes("biannual")) {
    return "bi-annual";
  }
  return "quarterly";
}

export function memberPriceAfterDiscount(
  listPrice: number,
  discountPercent: number | null,
): number | null {
  if (discountPercent == null) return null;
  return Math.round(listPrice * (1 - discountPercent / 100));
}

export function formatMemberPrice(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}

export function buildMemberContactHref(
  topic: "schedule-visit" | "add-on",
  propertySlug: string,
  serviceId?: string,
): string {
  const params = new URLSearchParams({ topic, property: propertySlug });
  if (serviceId) params.set("service", serviceId);
  return `${ROUTES.contact}?${params.toString()}`;
}

function resolvePlanName(data: HomeCarePlanData, planNameOverride?: string): string {
  if (planNameOverride?.trim()) return planNameOverride.trim();
  return (
    data.property.membershipRecommendation ||
    data.memberships.find((tier) => tier.highlighted)?.name ||
    data.memberships[0]?.name ||
    "Preferred Care"
  );
}

function resolveLastVisitService(
  homeownerSlug: string,
  propertySlug: string,
): string | null {
  const property = getPropertyBySlug(propertyHubContext, propertySlug);
  if (!property || propertyHubContext.homeowner.slug !== homeownerSlug) {
    return null;
  }
  const latest = property.recentTimeline[0];
  return latest?.title ?? null;
}

/** Portal care summary — mock/property-hub backed until production membership API. */
export function resolveMemberPortalStatus(
  data: HomeCarePlanData,
  options?: { planName?: string; forceNoNextVisit?: boolean },
): MemberPortalStatus {
  const planName = resolvePlanName(data, options?.planName);
  const cadence = inferMembershipCadence(planName);
  const discountPercent = MEMBER_ADD_ON_DISCOUNT[cadence] ?? null;

  const hubProperty = getPropertyBySlug(propertyHubContext, data.property.slug);
  const hubMatches =
    hubProperty &&
    propertyHubContext.homeowner.slug === data.homeowner.slug;

  const lastVisit =
    (hubMatches && hubProperty.lastVisit) || data.property.lastVisit || null;

  const nextVisit =
    options?.forceNoNextVisit || !hubMatches
      ? null
      : hubProperty.nextScheduledVisit;

  const addOns = MEMBER_ADD_ON_CATALOG.map((addon) => ({
    ...addon,
    memberPrice: memberPriceAfterDiscount(addon.listPrice, discountPercent),
  }));

  return {
    planName,
    cadence,
    cadenceLabel: CADENCE_LABEL[cadence],
    serviceSummary: SERVICE_SUMMARY[cadence],
    lastVisit,
    lastVisitService: resolveLastVisitService(
      data.homeowner.slug,
      data.property.slug,
    ),
    nextVisit,
    addOnDiscountPercent: discountPercent,
    addOns,
    scheduleVisitHref: buildMemberContactHref(
      "schedule-visit",
      data.property.slug,
    ),
  };
}
