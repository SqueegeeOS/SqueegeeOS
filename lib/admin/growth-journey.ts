import type { ClosedJob } from "./closed-jobs-types";
import type { LegacyBaseline } from "./legacy-baseline";
import {
  filterJobsByPeriod,
  getArrValue,
  getImmediateRevenue,
} from "./sales-calculations";

export type GrowthJourneyTierId =
  | "foundation"
  | "momentum"
  | "market_leader"
  | "dynasty";

export interface GrowthMilestone {
  id: string;
  label: string;
  achieved: boolean;
  /** True when earned before SqueegeeKing OS */
  achievedByLegacy?: boolean;
}

export interface GrowthJourneyTier {
  id: GrowthJourneyTierId;
  label: string;
  milestones: GrowthMilestone[];
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

export interface BusinessLedger {
  legacy: OperatingSnapshot;
  operatingSystem: OperatingSnapshot;
  company: OperatingSnapshot;
  osLaunchedDate: string;
  legacyConfigured: boolean;
}

export interface OperatingContext {
  closedJobs: ClosedJob[];
  activeMembers: number;
  homeCarePlansCreated: number;
  pendingRequests: number;
  legacyBaseline: LegacyBaseline;
  osLaunchedDate: string;
}

export const ARR_MILESTONE_LADDER = [
  5_000, 10_000, 25_000, 100_000, 500_000, 1_000_000,
] as const;

export const DEFAULT_MONTHLY_SALES_GOAL = 10_000;
export const DEFAULT_MONTHLY_JOBS_GOAL = 5;

export function filterOperatingSystemJobs(
  jobs: ClosedJob[],
  osLaunchedDate: string,
): ClosedJob[] {
  return jobs.filter((job) => {
    const closedOn = job.closedDate;
    const createdOn = job.createdAt.slice(0, 10);
    return closedOn >= osLaunchedDate || createdOn >= osLaunchedDate;
  });
}

function snapshotFromJobs(
  jobs: ClosedJob[],
  homesProtected: number,
): OperatingSnapshot {
  const currentMonthJobs = filterJobsByPeriod(jobs, "current_month");

  const lifetimeRevenue = jobs.reduce(
    (sum, job) => sum + getImmediateRevenue(job),
    0,
  );
  const lifetimeArr = jobs.reduce((sum, job) => sum + getArrValue(job), 0);
  const monthlyRevenueCollected = currentMonthJobs.reduce(
    (sum, job) => sum + getImmediateRevenue(job),
    0,
  );
  const monthlyArrGenerated = currentMonthJobs.reduce(
    (sum, job) => sum + getArrValue(job),
    0,
  );

  return {
    lifetimeRevenue,
    lifetimeArr,
    monthlyRevenueCollected,
    monthlyArrGenerated,
    monthlySalesPerformance: monthlyRevenueCollected + monthlyArrGenerated,
    homesProtected,
    membersProtected: jobs.filter(
      (job) => job.saleType === "recurring_membership",
    ).length,
    closedJobsCount: jobs.length,
    membershipsSold: jobs.filter(
      (job) => job.saleType === "recurring_membership",
    ).length,
  };
}

function snapshotFromLegacyBaseline(
  baseline: LegacyBaseline,
): OperatingSnapshot {
  return {
    lifetimeRevenue: baseline.lifetimeRevenue,
    lifetimeArr: baseline.lifetimeArr,
    monthlyRevenueCollected: 0,
    monthlyArrGenerated: 0,
    monthlySalesPerformance: 0,
    homesProtected: baseline.homesServed || baseline.homesProtected,
    membersProtected: baseline.recurringCustomers || baseline.activeMembers,
    closedJobsCount: baseline.closedJobs,
    membershipsSold: baseline.membershipsSold,
  };
}

function mergeSnapshots(
  legacy: OperatingSnapshot,
  operatingSystem: OperatingSnapshot,
): OperatingSnapshot {
  return {
    lifetimeRevenue: legacy.lifetimeRevenue + operatingSystem.lifetimeRevenue,
    lifetimeArr: legacy.lifetimeArr + operatingSystem.lifetimeArr,
    monthlyRevenueCollected: operatingSystem.monthlyRevenueCollected,
    monthlyArrGenerated: operatingSystem.monthlyArrGenerated,
    monthlySalesPerformance: operatingSystem.monthlySalesPerformance,
    homesProtected: legacy.homesProtected + operatingSystem.homesProtected,
    membersProtected:
      legacy.membersProtected + operatingSystem.membershipsSold,
    closedJobsCount:
      legacy.closedJobsCount + operatingSystem.closedJobsCount,
    membershipsSold:
      legacy.membershipsSold + operatingSystem.membershipsSold,
  };
}

export function computeBusinessLedger(context: OperatingContext): BusinessLedger {
  const osJobs = filterOperatingSystemJobs(
    context.closedJobs,
    context.osLaunchedDate,
  );
  const osUniqueHomes = new Set(
    osJobs.map((job) => job.propertyAddress.trim().toLowerCase()),
  ).size;
  const osHomesProtected = osUniqueHomes;

  const legacy = snapshotFromLegacyBaseline(context.legacyBaseline);
  const operatingSystem = snapshotFromJobs(osJobs, osHomesProtected);
  const company = mergeSnapshots(legacy, operatingSystem);

  return {
    legacy,
    operatingSystem,
    company,
    osLaunchedDate: context.osLaunchedDate,
    legacyConfigured: context.legacyBaseline.configured,
  };
}

/** @deprecated Use computeBusinessLedger */
export function computeOperatingSnapshot(
  context: OperatingContext,
): OperatingSnapshot {
  return computeBusinessLedger(context).company;
}

function checkNumericMilestone(
  companyValue: number,
  legacyValue: number,
  threshold: number,
): { achieved: boolean; achievedByLegacy: boolean } {
  const achieved = companyValue >= threshold;
  return {
    achieved,
    achievedByLegacy: achieved && legacyValue >= threshold,
  };
}

function checkMilestone(
  id: string,
  company: OperatingSnapshot,
  legacy: OperatingSnapshot,
  operatingSystem: OperatingSnapshot,
  context: OperatingContext,
): { achieved: boolean; achievedByLegacy: boolean } {
  const baseline = context.legacyBaseline;

  switch (id) {
    case "first_closed_job":
      return checkNumericMilestone(
        company.closedJobsCount,
        legacy.closedJobsCount,
        1,
      );
    case "first_recurring_membership":
      return checkNumericMilestone(
        company.membershipsSold,
        legacy.membershipsSold,
        1,
      );
    case "lifetime_revenue_1k":
      return checkNumericMilestone(
        company.lifetimeRevenue,
        legacy.lifetimeRevenue,
        1_000,
      );
    case "arr_5k":
      return checkNumericMilestone(company.lifetimeArr, legacy.lifetimeArr, 5_000);
    case "homes_10":
      return checkNumericMilestone(
        company.homesProtected,
        legacy.homesProtected,
        10,
      );
    case "members_25":
      return checkNumericMilestone(
        company.membersProtected,
        legacy.membersProtected,
        25,
      );
    case "monthly_sales_10k":
      return {
        achieved: operatingSystem.monthlySalesPerformance >= 10_000,
        achievedByLegacy: false,
      };
    case "lifetime_revenue_50k":
      return checkNumericMilestone(
        company.lifetimeRevenue,
        legacy.lifetimeRevenue,
        50_000,
      );
    case "arr_25k":
      return checkNumericMilestone(
        company.lifetimeArr,
        legacy.lifetimeArr,
        25_000,
      );
    case "closed_jobs_100":
      return checkNumericMilestone(
        company.closedJobsCount,
        legacy.closedJobsCount,
        100,
      );
    case "reviews_100":
      return {
        achieved: baseline.googleReviews >= 100,
        achievedByLegacy: baseline.googleReviews >= 100,
      };
    case "members_100":
      return checkNumericMilestone(
        company.membersProtected,
        legacy.membersProtected,
        100,
      );
    case "arr_100k":
      return checkNumericMilestone(
        company.lifetimeArr,
        legacy.lifetimeArr,
        100_000,
      );
    case "lifetime_revenue_250k":
      return checkNumericMilestone(
        company.lifetimeRevenue,
        legacy.lifetimeRevenue,
        250_000,
      );
    case "homes_500":
      return checkNumericMilestone(
        company.homesProtected,
        legacy.homesProtected,
        500,
      );
    case "first_employee":
      return {
        achieved: baseline.hasEmployee,
        achievedByLegacy: baseline.hasEmployee,
      };
    case "first_company_truck":
      return {
        achieved: baseline.hasCompanyTruck,
        achievedByLegacy: baseline.hasCompanyTruck,
      };
    case "members_500":
      return checkNumericMilestone(
        company.membersProtected,
        legacy.membersProtected,
        500,
      );
    case "arr_500k":
      return checkNumericMilestone(
        company.lifetimeArr,
        legacy.lifetimeArr,
        500_000,
      );
    case "lifetime_revenue_1m":
      return checkNumericMilestone(
        company.lifetimeRevenue,
        legacy.lifetimeRevenue,
        1_000_000,
      );
    case "multi_city_expansion":
      return {
        achieved: baseline.multiCityExpansion,
        achievedByLegacy: baseline.multiCityExpansion,
      };
    default:
      return { achieved: false, achievedByLegacy: false };
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
    id: "dynasty",
    label: "Dynasty",
    milestoneIds: [
      { id: "members_500", label: "500 Members" },
      { id: "arr_500k", label: "$500,000 ARR" },
      { id: "lifetime_revenue_1m", label: "$1,000,000 Lifetime Revenue" },
      { id: "multi_city_expansion", label: "Multi-city Expansion" },
    ],
  },
];

export function computeGrowthJourney(context: OperatingContext): GrowthJourneyTier[] {
  const ledger = computeBusinessLedger(context);

  return TIER_DEFINITIONS.map((tier) => ({
    id: tier.id,
    label: tier.label,
    milestones: tier.milestoneIds.map((item) => {
      const result = checkMilestone(
        item.id,
        ledger.company,
        ledger.legacy,
        ledger.operatingSystem,
        context,
      );
      return {
        id: item.id,
        label: item.label,
        achieved: result.achieved,
        achievedByLegacy: result.achievedByLegacy,
      };
    }),
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
