import type { ClosedJob } from "./closed-jobs-types";
import { getArrValue, getImmediateRevenue } from "./sales-calculations";

export interface CompanyMilestone {
  id: string;
  label: string;
  achieved: boolean;
}

export interface MilestoneContext {
  closedJobs: ClosedJob[];
  activeMembers: number;
  homeCarePlansCreated: number;
}

export function computeCompanyMilestones({
  closedJobs,
  activeMembers,
  homeCarePlansCreated,
}: MilestoneContext): CompanyMilestone[] {
  const lifetimeRevenue = closedJobs.reduce(
    (sum, job) => sum + getImmediateRevenue(job),
    0,
  );
  const lifetimeArr = closedJobs.reduce(
    (sum, job) => sum + getArrValue(job),
    0,
  );
  const uniqueHomes = new Set(
    closedJobs.map((job) => job.propertyAddress.trim().toLowerCase()),
  ).size;
  const homesProtected = Math.max(homeCarePlansCreated, uniqueHomes);

  return [
    {
      id: "first_closed_job",
      label: "First Closed Job",
      achieved: closedJobs.length >= 1,
    },
    {
      id: "lifetime_revenue_1k",
      label: "$1,000 Lifetime Revenue",
      achieved: lifetimeRevenue >= 1000,
    },
    {
      id: "first_membership",
      label: "First Membership Sold",
      achieved: closedJobs.some(
        (job) => job.saleType === "recurring_membership",
      ),
    },
    {
      id: "active_members_10",
      label: "10 Active Members",
      achieved: activeMembers >= 10,
    },
    {
      id: "arr_10k",
      label: "$10,000 ARR",
      achieved: lifetimeArr >= 10000,
    },
    {
      id: "homes_100",
      label: "100 Homes Protected",
      achieved: homesProtected >= 100,
    },
    {
      id: "lifetime_revenue_100k",
      label: "$100,000 Lifetime Revenue",
      achieved: lifetimeRevenue >= 100000,
    },
  ];
}
