import {
  ARR_MILESTONE_LADDER,
  DEFAULT_MONTHLY_SALES_GOAL,
  computeBusinessLedger,
  computeGrowthJourney,
  formatArrMilestoneLabel,
  getNextArrMilestone,
  type BusinessLedger,
  type OperatingContext,
} from "./growth-journey";
import { legacyBaselineHasHistory } from "./legacy-baseline";

export interface ProgressMetric {
  label: string;
  current: number;
  target: number;
  progress: number;
}

export interface CeoScoreboard {
  ledger: BusinessLedger;
  revenueCollected: number;
  arrGenerated: number;
  monthlySalesPerformance: number;
  arrProgress: ProgressMetric;
  monthlyGoalProgress: ProgressMetric;
  businessHealthScore: number;
  businessHealthExplanation: string;
}

function clampProgress(current: number, target: number): number {
  if (target <= 0) return current > 0 ? 100 : 0;
  return Math.min(100, Math.round((current / target) * 100));
}

function computeBusinessHealth(
  ledger: BusinessLedger,
  context: OperatingContext,
): { score: number; explanation: string } {
  const journey = computeGrowthJourney(context);
  const totalMilestones = journey.reduce(
    (sum, tier) => sum + tier.milestones.length,
    0,
  );
  const achievedMilestones = journey.reduce(
    (sum, tier) => sum + tier.milestones.filter((m) => m.achieved).length,
    0,
  );
  const journeyProgress =
    totalMilestones > 0 ? achievedMilestones / totalMilestones : 0;

  const os = ledger.operatingSystem;
  const company = ledger.company;

  const monthlyGoalRatio = Math.min(
    1,
    os.monthlySalesPerformance / DEFAULT_MONTHLY_SALES_GOAL,
  );
  const recurringRatio =
    company.lifetimeRevenue > 0
      ? Math.min(1, company.lifetimeArr / (company.lifetimeRevenue * 2))
      : 0;
  const membershipRatio = Math.min(1, company.membersProtected / 25);
  const pipelinePenalty = Math.min(15, context.pendingRequests * 3);
  const legacyHonorBonus = legacyBaselineHasHistory(context.legacyBaseline)
    ? 8
    : 0;

  const rawScore =
    journeyProgress * 30 +
    monthlyGoalRatio * 25 +
    recurringRatio * 18 +
    membershipRatio * 12 +
    legacyHonorBonus +
    (os.closedJobsCount > 0 ? 5 : 0) -
    pipelinePenalty;

  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  let explanation: string;
  if (legacyBaselineHasHistory(context.legacyBaseline) && os.closedJobsCount === 0) {
    explanation =
      "Your legacy is honored. Log sales in the Operating System to track forward momentum.";
  } else if (os.closedJobsCount === 0) {
    explanation =
      "Record your legacy baseline and log OS sales to activate the full command center.";
  } else if (monthlyGoalRatio < 0.5) {
    explanation =
      "Operating System sales are building this month. Legacy plus new logged jobs shape company totals.";
  } else if (recurringRatio < 0.3) {
    explanation =
      "Cash is flowing through the OS. Growing recurring memberships strengthens long-term value.";
  } else if (context.pendingRequests > 2) {
    explanation =
      "Strong company foundation. Clear pending requests to keep pipeline velocity high.";
  } else if (score >= 75) {
    explanation =
      "Healthy momentum — legacy honored, Operating System tracking forward with clarity.";
  } else if (score >= 50) {
    explanation =
      "Solid progress across legacy and OS. Every logged sale adds to the true company story.";
  } else {
    explanation =
      "Early OS chapter with legacy intact. Every forward sale compounds your trajectory.";
  }

  return { score, explanation };
}

export function computeCeoScoreboard(context: OperatingContext): CeoScoreboard {
  const ledger = computeBusinessLedger(context);
  const os = ledger.operatingSystem;
  const company = ledger.company;

  const nextArr = getNextArrMilestone(company.lifetimeArr);
  const arrTarget =
    nextArr?.target ?? ARR_MILESTONE_LADDER[ARR_MILESTONE_LADDER.length - 1];
  const arrLabel = nextArr
    ? formatArrMilestoneLabel(nextArr.target)
    : "$1M+ ARR";

  const health = computeBusinessHealth(ledger, context);

  return {
    ledger,
    revenueCollected: os.monthlyRevenueCollected,
    arrGenerated: os.monthlyArrGenerated,
    monthlySalesPerformance: os.monthlySalesPerformance,
    arrProgress: {
      label: `Company ARR · Progress to ${arrLabel}`,
      current: company.lifetimeArr,
      target: arrTarget,
      progress: clampProgress(company.lifetimeArr, arrTarget),
    },
    monthlyGoalProgress: {
      label: "Operating System · Monthly Goal",
      current: os.monthlySalesPerformance,
      target: DEFAULT_MONTHLY_SALES_GOAL,
      progress: clampProgress(
        os.monthlySalesPerformance,
        DEFAULT_MONTHLY_SALES_GOAL,
      ),
    },
    businessHealthScore: health.score,
    businessHealthExplanation: health.explanation,
  };
}
