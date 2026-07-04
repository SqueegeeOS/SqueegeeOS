import type { CurrentMission } from "@/lib/admin/current-mission";
import {
  computeBusinessLedger,
  DEFAULT_MONTHLY_SALES_GOAL,
  filterOperatingSystemJobs,
  getNextArrMilestone,
  type OperatingContext,
} from "@/lib/admin/growth-journey";
import { filterJobsByPeriod, formatCurrency } from "@/lib/admin/sales-calculations";
import type {
  ConciergeInsight,
  GoogleReviewsBriefSnapshot,
  MorningBriefInput,
} from "./types";

/** Bi-annual membership at $325/service → $650 ARR per membership */
export const BI_ANNUAL_SERVICE_PRICE = 325;
export const BI_ANNUAL_MEMBERSHIP_ARR = BI_ANNUAL_SERVICE_PRICE * 2;

export type ConciergeRule = (
  input: MorningBriefInput,
) => ConciergeInsight | null;

function currentMonthOsJobs(context: OperatingContext) {
  const osJobs = filterOperatingSystemJobs(
    context.closedJobs,
    context.osLaunchedDate,
  );
  return filterJobsByPeriod(osJobs, "current_month");
}

export const revenueMomentumRule: ConciergeRule = (input) => {
  const ledger = computeBusinessLedger(input.operatingContext);
  const monthlyPerformance = ledger.operatingSystem.monthlySalesPerformance;
  const monthJobs = currentMonthOsJobs(input.operatingContext);

  if (monthJobs.length === 0 && monthlyPerformance <= 0) return null;

  const gap = DEFAULT_MONTHLY_SALES_GOAL - monthlyPerformance;

  if (gap > 0) {
    return {
      id: "revenue_momentum",
      category: "revenue",
      title: "Revenue Momentum",
      body: `You are ${formatCurrency(gap)} away from this month's sales performance goal.`,
      priority: 10,
    };
  }

  if (monthlyPerformance > DEFAULT_MONTHLY_SALES_GOAL) {
    return {
      id: "revenue_momentum",
      category: "revenue",
      title: "Revenue Momentum",
      body: `You exceeded this month's sales performance goal by ${formatCurrency(Math.abs(gap))}.`,
      priority: 10,
    };
  }

  return {
    id: "revenue_momentum",
    category: "revenue",
    title: "Revenue Momentum",
    body: "You hit this month's sales performance goal. Protect the momentum with consistent follow-through.",
    priority: 10,
  };
};

export const arrFocusRule: ConciergeRule = (input) => {
  const ledger = computeBusinessLedger(input.operatingContext);
  const nextArr = getNextArrMilestone(ledger.company.lifetimeArr);
  if (!nextArr) return null;

  const gap = nextArr.target - ledger.company.lifetimeArr;
  if (gap <= 0) return null;

  const membershipsNeeded = Math.max(
    1,
    Math.ceil(gap / BI_ANNUAL_MEMBERSHIP_ARR),
  );

  return {
    id: "arr_focus",
    category: "arr",
    title: "ARR Focus",
    body: `Close ${membershipsNeeded} more bi-annual membership${membershipsNeeded === 1 ? "" : "s"} at $${BI_ANNUAL_SERVICE_PRICE}/service to reach the next ARR milestone (${formatCurrency(nextArr.target)}).`,
    priority: 20,
  };
};

export const reviewOpportunityRule: ConciergeRule = (input) => {
  const reviews = input.googleReviews;
  if (!reviews?.connected || reviews.totalCount <= 0) return null;

  return {
    id: "review_opportunity",
    category: "reputation",
    title: "Review Opportunity",
    body: `You currently have ${reviews.totalCount.toLocaleString("en-US")} review${reviews.totalCount === 1 ? "" : "s"}${reviews.averageRating > 0 ? ` at ${reviews.averageRating.toFixed(1)} stars` : ""}. Ask 2 happy customers this week to keep reputation compounding.`,
    priority: 30,
  };
};

export const followUpReminderRule: ConciergeRule = (input) => {
  const pending = input.dashboard.executive.pendingRequests;
  if (pending <= 0) return null;

  return {
    id: "follow_up_reminder",
    category: "operations",
    title: "Follow-Up Reminder",
    body: `Follow up with ${pending} pending request${pending === 1 ? "" : "s"}.`,
    priority: 40,
  };
};

export const membershipFocusRule: ConciergeRule = (input) => {
  const monthJobs = currentMonthOsJobs(input.operatingContext);
  if (monthJobs.length === 0) return null;

  const oneTime = monthJobs.filter((job) => job.saleType === "one_time").length;
  const recurring = monthJobs.filter(
    (job) => job.saleType === "recurring_membership",
  ).length;

  if (oneTime <= recurring || oneTime === 0) return null;

  return {
    id: "membership_focus",
    category: "membership",
    title: "Membership Focus",
    body: "Recurring memberships are lagging behind one-time jobs. Focus today on converting one-time customers into members.",
    priority: 50,
  };
};

export const homeCarePlansRule: ConciergeRule = (input) => {
  const plans = input.dashboard.executive.homeCarePlansCreated;
  const agreements = input.dashboard.executive.signedAgreements;
  if (plans <= 0 && agreements <= 0) return null;

  if (plans > 0 && agreements < plans) {
    const unsigned = plans - agreements;
    return {
      id: "home_care_agreements",
      category: "platform",
      title: "Home Care Plans",
      body: `${plans} Home Care Plan${plans === 1 ? " is" : "s are"} on file with ${unsigned} awaiting signed agreement${unsigned === 1 ? "" : "s"}. Close the loop while trust is fresh.`,
      priority: 55,
    };
  }

  if (plans > 0) {
    return {
      id: "home_care_plans",
      category: "platform",
      title: "Home Care Plans",
      body: `${plans} Home Care Plan${plans === 1 ? "" : "s"} created. Keep momentum by pairing each plan with a membership conversation.`,
      priority: 56,
    };
  }

  return null;
};

export const activeMembersRule: ConciergeRule = (input) => {
  const active = input.dashboard.membership.active;
  const pending = input.dashboard.membership.pending;
  if (active <= 0 && pending <= 0) return null;
  if (pending <= 0) return null;

  return {
    id: "membership_checkout",
    category: "membership",
    title: "Membership Pipeline",
    body: `${pending} membership${pending === 1 ? "" : "s"} pending checkout. Follow up to convert interest into recurring revenue.`,
    priority: 57,
  };
};

export const missionHighlightRule: ConciergeRule = (input) => {
  const top = input.missions[0];
  if (!top) return null;

  return {
    id: `mission_${top.id}`,
    category: "operations",
    title: "Current Mission",
    body: top.text,
    priority: 90,
  };
};

export const CONCIERGE_RULES: ConciergeRule[] = [
  revenueMomentumRule,
  arrFocusRule,
  reviewOpportunityRule,
  followUpReminderRule,
  membershipFocusRule,
  homeCarePlansRule,
  activeMembersRule,
  missionHighlightRule,
];

export function hasEnoughConciergeData(input: MorningBriefInput): boolean {
  const ledger = computeBusinessLedger(input.operatingContext);
  const monthJobs = currentMonthOsJobs(input.operatingContext);

  return (
    ledger.legacyConfigured ||
    ledger.operatingSystem.closedJobsCount > 0 ||
    monthJobs.length > 0 ||
    input.dashboard.membership.active > 0 ||
    input.dashboard.executive.homeCarePlansCreated > 0 ||
    input.dashboard.executive.signedAgreements > 0 ||
    Boolean(input.googleReviews?.connected && input.googleReviews.totalCount > 0)
  );
}

export function toGoogleReviewsSnapshot(
  status: string | undefined,
  data: { totalCount: number; averageRating: number; isSampleData?: boolean } | null | undefined,
): GoogleReviewsBriefSnapshot | null {
  if (status !== "live" && status !== "cached") return null;
  if (!data || data.isSampleData || data.totalCount <= 0) return null;

  return {
    connected: true,
    totalCount: data.totalCount,
    averageRating: data.averageRating,
  };
}