import {
  DEFAULT_MONTHLY_JOBS_GOAL,
  DEFAULT_MONTHLY_SALES_GOAL,
  type OperatingContext,
  type OperatingSnapshot,
  computeOperatingSnapshot,
  formatArrMilestoneLabel,
  getNextArrMilestone,
} from "./growth-journey";
import { filterJobsByPeriod, formatCurrency } from "./sales-calculations";

export interface CurrentMission {
  id: string;
  text: string;
  priority: number;
}

const AVERAGE_MEMBERSHIP_ARR = 650;

export function computeCurrentMissions(
  context: OperatingContext,
  snapshot: OperatingSnapshot = computeOperatingSnapshot(context),
): CurrentMission[] {
  const missions: CurrentMission[] = [];

  if (snapshot.closedJobsCount === 0) {
    return [
      {
        id: "first_job",
        text: "Log your first closed job to begin the Growth Journey.",
        priority: 1,
      },
      {
        id: "first_membership",
        text: "Sell your first recurring membership to build ARR.",
        priority: 2,
      },
    ];
  }

  const nextArr = getNextArrMilestone(snapshot.lifetimeArr);
  if (nextArr) {
    const gap = nextArr.target - snapshot.lifetimeArr;
    const membershipsNeeded = Math.max(
      1,
      Math.ceil(gap / AVERAGE_MEMBERSHIP_ARR),
    );
    if (gap > 0) {
      missions.push({
        id: "arr_gap",
        text: `Close ${membershipsNeeded} more membership${membershipsNeeded === 1 ? "" : "s"} to reach ${formatArrMilestoneLabel(nextArr.target)} ARR.`,
        priority: 1,
      });
    }
  }

  const currentMonthJobs = filterJobsByPeriod(
    context.closedJobs,
    "current_month",
  ).length;
  const jobsToGoal = Math.max(0, DEFAULT_MONTHLY_JOBS_GOAL - currentMonthJobs);

  if (jobsToGoal > 0) {
    missions.push({
      id: "monthly_jobs",
      text: `Complete ${jobsToGoal} more job${jobsToGoal === 1 ? "" : "s"} to hit this month's goal.`,
      priority: 2,
    });
  }

  const salesGap = DEFAULT_MONTHLY_SALES_GOAL - snapshot.monthlySalesPerformance;
  if (salesGap > 0 && snapshot.monthlySalesPerformance > 0) {
    missions.push({
      id: "monthly_sales",
      text: `Generate ${formatCurrency(salesGap)} more in monthly sales performance to reach your ${formatCurrency(DEFAULT_MONTHLY_SALES_GOAL)} goal.`,
      priority: 3,
    });
  }

  if (context.pendingRequests > 0) {
    missions.push({
      id: "pending_requests",
      text: `Follow up with ${context.pendingRequests} pending request${context.pendingRequests === 1 ? "" : "s"}.`,
      priority: 4,
    });
  }

  const recentCustomers = Math.min(
    2,
    new Set(
      context.closedJobs
        .slice(0, 5)
        .map((job) => job.customerName.trim()),
    ).size,
  );
  if (recentCustomers > 0 && snapshot.closedJobsCount >= 3) {
    missions.push({
      id: "reviews",
      text: `Ask ${Math.min(2, recentCustomers)} recent customer${recentCustomers === 1 ? "" : "s"} for reviews.`,
      priority: 5,
    });
  }

  if (snapshot.membershipsSold === 0) {
    missions.push({
      id: "build_recurring",
      text: "Convert your next one-time customer into a recurring membership.",
      priority: 6,
    });
  }

  return missions
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 4);
}
