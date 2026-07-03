import type { ClosedJob } from "./closed-jobs-types";
import {
  filterJobsByPeriod,
  getArrValue,
  getImmediateRevenue,
} from "./sales-calculations";

export type GrowthJourneyTierId =
  | "foundation"
  | "momentum"
  | "market_leader"
  | "legacy";

export interface GrowthMilestone {
  id: string;
  label: string;
  achieved: boolean;
}

export interface GrowthJourneyTier {
  id: GrowthJourneyTierId;
  label: string;
  milestones: GrowthMilestone[];
}

export interface OperatingContext {
  closedJobs: ClosedJob[];
  activeMembers: number;
  homeCarePlansCreated: number;
  pendingRequests: number;
  fiveStarReviews?: number;
  hasEmployee?: boolean;
  hasCompanyTruck?: boolean;
  multiCityExpansion?: boolean;
}

export interface OperatingSnapshot {
  lifetimeRevenue: number;
  lifetimeArr: number;
  monthlyRevenueCollected: number;
  monthlyArrGenerated: number;
  monthlySalesPerformance: number;
  homesProtected: number;
  membersProtected: number;
  closedJobsCount: number;
  membershipsSold: number;
}

export const ARR_MILESTONE_LADDER = [
  5_000, 10_000, 25_000, 100_000, 500_000, 1_000_000,
] as const;

export const DEFAULT_MONTHLY_SALES_GOAL = 10_000;
export const DEFAULT_MONTHLY_JOBS_GOAL = 5;

export function computeOperatingSnapshot(
  context: OperatingContext,
): OperatingSnapshot {
  const { closedJobs, activeMembers, homeCarePlansCreated } = context;
  const currentMonthJobs = filterJobsByPeriod(closedJobs, "current_month");

  const lifetimeRevenue = closedJobs.reduce(
    (sum, job) => sum + getImmediateRevenue(job),
    0,
  );
  const lifetimeArr = closedJobs.reduce(
    (sum, job) => sum + getArrValue(job),
    0,
  );
  const monthlyRevenueCollected = currentMonthJobs.reduce(
    (sum, job) => sum + getImmediateRevenue(job),
    0,
  );
  const monthlyArrGenerated = currentMonthJobs.reduce(
    (sum, job) => sum + getArrValue(job),
    0,
  );
  const uniqueHomes = new Set(
    closedJobs.map((job) => job.propertyAddress.trim().toLowerCase()),
  ).size;

  return {
    lifetimeRevenue,
    lifetimeArr,
    monthlyRevenueCollected,
    monthlyArrGenerated,
    monthlySalesPerformance: monthlyRevenueCollected + monthlyArrGenerated,
    homesProtected: Math.max(homeCarePlansCreated, uniqueHomes),
    membersProtected: activeMembers,
    closedJobsCount: closedJobs.length,
    membershipsSold: closedJobs.filter(
      (job) => job.saleType === "recurring_membership",
    ).length,
  };
}

function checkMilestone(
  id: string,
  snapshot: OperatingSnapshot,
  context: OperatingContext,
): boolean {
  const reviews = context.fiveStarReviews ?? 0;

  switch (id) {
    case "first_closed_job":
      return snapshot.closedJobsCount >= 1;
    case "first_recurring_membership":
      return snapshot.membershipsSold >= 1;
    case "lifetime_revenue_1k":
      return snapshot.lifetimeRevenue >= 1_000;
    case "arr_5k":
      return snapshot.lifetimeArr >= 5_000;
    case "homes_10":
      return snapshot.homesProtected >= 10;
    case "members_25":
      return snapshot.membersProtected >= 25;
    case "monthly_sales_10k":
      return snapshot.monthlySalesPerformance >= 10_000;
    case "lifetime_revenue_50k":
      return snapshot.lifetimeRevenue >= 50_000;
    case "arr_25k":
      return snapshot.lifetimeArr >= 25_000;
    case "closed_jobs_100":
      return snapshot.closedJobsCount >= 100;
    case "reviews_100":
      return reviews >= 100;
    case "members_100":
      return snapshot.membersProtected >= 100;
    case "arr_100k":
      return snapshot.lifetimeArr >= 100_000;
    case "lifetime_revenue_250k":
      return snapshot.lifetimeRevenue >= 250_000;
    case "homes_500":
      return snapshot.homesProtected >= 500;
    case "first_employee":
      return context.hasEmployee === true;
    case "first_company_truck":
      return context.hasCompanyTruck === true;
    case "members_500":
      return snapshot.membersProtected >= 500;
    case "arr_500k":
      return snapshot.lifetimeArr >= 500_000;
    case "lifetime_revenue_1m":
      return snapshot.lifetimeRevenue >= 1_000_000;
    case "multi_city_expansion":
      return context.multiCityExpansion === true;
    default:
      return false;
  }
}

const TIER_DEFINITIONS: Array<{
  id: GrowthJourneyTierId;
  label: string;
  milestoneIds: Array<{ id: string; label: string }>;
}> = [
  {
    id: "foundation",
    label: "Foundation",
    milestoneIds: [
      { id: "first_closed_job", label: "First Closed Job" },
      { id: "first_recurring_membership", label: "First Recurring Membership" },
      { id: "lifetime_revenue_1k", label: "$1,000 Lifetime Revenue" },
      { id: "arr_5k", label: "$5,000 ARR" },
      { id: "homes_10", label: "10 Homes Protected" },
    ],
  },
  {
    id: "momentum",
    label: "Momentum",
    milestoneIds: [
      { id: "members_25", label: "25 Members" },
      { id: "monthly_sales_10k", label: "$10,000 Monthly Sales Performance" },
      { id: "lifetime_revenue_50k", label: "$50,000 Lifetime Revenue" },
      { id: "arr_25k", label: "$25,000 ARR" },
      { id: "closed_jobs_100", label: "100 Closed Jobs" },
      { id: "reviews_100", label: "100 Five-Star Reviews" },
    ],
  },
  {
    id: "market_leader",
    label: "Market Leader",
    milestoneIds: [
      { id: "members_100", label: "100 Members" },
      { id: "arr_100k", label: "$100,000 ARR" },
      { id: "lifetime_revenue_250k", label: "$250,000 Lifetime Revenue" },
      { id: "homes_500", label: "500 Homes Protected" },
      { id: "first_employee", label: "First Employee" },
      { id: "first_company_truck", label: "First Company Truck" },
    ],
  },
  {
    id: "legacy",
    label: "Legacy",
    milestoneIds: [
      { id: "members_500", label: "500 Members" },
      { id: "arr_500k", label: "$500,000 ARR" },
      { id: "lifetime_revenue_1m", label: "$1,000,000 Lifetime Revenue" },
      { id: "multi_city_expansion", label: "Multi-city Expansion" },
    ],
  },
];

export function computeGrowthJourney(context: OperatingContext): GrowthJourneyTier[] {
  const snapshot = computeOperatingSnapshot(context);

  return TIER_DEFINITIONS.map((tier) => ({
    id: tier.id,
    label: tier.label,
    milestones: tier.milestoneIds.map((item) => ({
      id: item.id,
      label: item.label,
      achieved: checkMilestone(item.id, snapshot, context),
    })),
  }));
}

export function getNextArrMilestone(currentArr: number): {
  target: number;
  label: string;
} | null {
  const next = ARR_MILESTONE_LADDER.find((target) => currentArr < target);
  if (!next) return null;
  return {
    target: next,
    label: `$${(next / 1000).toLocaleString("en-US")}k ARR`.replace("kk", "k"),
  };
}

export function formatArrMilestoneLabel(target: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(target);
}
