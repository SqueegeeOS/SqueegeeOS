import {
  DEFAULT_MONTHLY_JOBS_GOAL,
  DEFAULT_MONTHLY_SALES_GOAL,
  computeBusinessLedger,
  type OperatingContext,
} from "./growth-journey";
import { formatArrMilestoneLabel, getNextArrMilestone } from "./growth-journey";
import { filterJobsByPeriod, formatCurrency } from "./sales-calculations";

export interface CurrentMission {
  id: string;
  text: string;
  priority: number;
}

const AVERAGE_MEMBERSHIP_ARR = 650;

export function computeCurrentMissions(context: OperatingContext): CurrentMission[] {
  const ledger = computeBusinessLedger(context);
  const os = ledger.operatingSystem;
  const company = ledger.company;
  const missions: CurrentMission[] = [];

  if (!context.legacyBaseline.onboardingComplete) {
    missions.push({
      id: "record_legacy",
      text: "Record your legacy baseline — honor what you built before SqueegeeKing OS.",
      priority: 0,
    });
  }

  if (os.closedJobsCount === 0) {
    missions.push({
      id: "first_os_job",
      text: "Log your first closed job in the Operating System to begin tracking forward.",
      priority: 1,
    });
    if (company.membershipsSold === 0) {
      missions.push({
        id: "first_os_membership",
        text: "Sell your first recurring membership through the OS ledger.",
        priority: 2,
      });
    }
    return missions.sort((a, b) => a.priority - b.priority).slice(0, 4);
  }

  const nextArr = getNextArrMilestone(company.lifetimeArr);
  if (nextArr) {
    const gap = nextArr.target - company.lifetimeArr;
    const membershipsNeeded = Math.max(
      1,
      Math.ceil(gap / AVERAGE_MEMBERSHIP_ARR),
    );
    if (gap > 0) {
      missions.push({
        id: "arr_gap",
        text: `Close ${membershipsNeeded} more membership${membershipsNeeded === 1 ? "" : "s"} to reach ${formatArrMilestoneLabel(nextArr.target)} company ARR.`,
        priority: 2,
      });
    }
  }

  const osJobs = filterJobsByPeriod(
    context.closedJobs.filter(
      (job) =>
        job.closedDate >= context.osLaunchedDate ||
        job.createdAt.slice(0, 10) >= context.osLaunchedDate,
    ),
    "current_month",
  ).length;
  const jobsToGoal = Math.max(0, DEFAULT_MONTHLY_JOBS_GOAL - osJobs);

  if (jobsToGoal > 0) {
    missions.push({
      id: "monthly_jobs",
      text: `Complete ${jobsToGoal} more OS job${jobsToGoal === 1 ? "" : "s"} to hit this month's goal.`,
      priority: 3,
    });
  }

  const salesGap = DEFAULT_MONTHLY_SALES_GOAL - os.monthlySalesPerformance;
  if (salesGap > 0 && os.monthlySalesPerformance > 0) {
    missions.push({
      id: "monthly_sales",
      text: `Generate ${formatCurrency(salesGap)} more in OS monthly sales performance.`,
      priority: 4,
    });
  }

  if (context.pendingRequests > 0) {
    missions.push({
      id: "pending_requests",
      text: `Follow up with ${context.pendingRequests} pending request${context.pendingRequests === 1 ? "" : "s"}.`,
      priority: 5,
    });
  }

  if (os.membershipsSold === 0 && company.membershipsSold > 0) {
    missions.push({
      id: "build_os_recurring",
      text: "Log your next membership sale in the Operating System.",
      priority: 6,
    });
  }

  return missions.sort((a, b) => a.priority - b.priority).slice(0, 4);
}
