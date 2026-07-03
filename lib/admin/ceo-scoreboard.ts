import {
  ARR_MILESTONE_LADDER,
  DEFAULT_MONTHLY_SALES_GOAL,
  computeGrowthJourney,
  type OperatingContext,
  type OperatingSnapshot,
  computeOperatingSnapshot,
  formatArrMilestoneLabel,
  getNextArrMilestone,
} from "./growth-journey";

export interface ProgressMetric {
  label: string;
  current: number;
  target: number;
  progress: number;
}

export interface CeoScoreboard {
  revenueCollected: number;
  arrGenerated: number;
  monthlySalesPerformance: number;
  lifetimeRevenue: number;
  lifetimeArr: number;
  homesProtected: number;
  membersProtected: number;
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
  snapshot: OperatingSnapshot,
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

  const monthlyGoalRatio = Math.min(
    1,
    snapshot.monthlySalesPerformance / DEFAULT_MONTHLY_SALES_GOAL,
  );
  const recurringRatio =
    snapshot.lifetimeRevenue > 0
      ? Math.min(1, snapshot.lifetimeArr / (snapshot.lifetimeRevenue * 2))
      : 0;
  const membershipRatio = Math.min(1, snapshot.membersProtected / 25);
  const pipelinePenalty = Math.min(15, context.pendingRequests * 3);

  const rawScore =
    journeyProgress * 35 +
    monthlyGoalRatio * 25 +
    recurringRatio * 20 +
    membershipRatio * 15 +
    (snapshot.closedJobsCount > 0 ? 5 : 0) -
    pipelinePenalty;

  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  let explanation: string;
  if (snapshot.closedJobsCount === 0) {
    explanation =
      "Your cockpit is ready. Log your first sale to activate revenue momentum.";
  } else if (monthlyGoalRatio < 0.5) {
    explanation =
      "Monthly sales performance is building. Focus on closing jobs and memberships this month.";
  } else if (recurringRatio < 0.3) {
    explanation =
      "Cash is flowing. Growing recurring memberships will strengthen long-term business value.";
  } else if (context.pendingRequests > 2) {
    explanation =
      "Strong foundation. Clear pending requests to keep pipeline velocity high.";
  } else if (score >= 75) {
    explanation =
      "Healthy momentum across revenue, recurring value, and customer protection.";
  } else if (score >= 50) {
    explanation =
      "Solid progress. Push toward the next Growth Journey milestone to accelerate.";
  } else {
    explanation =
      "Early stage with clear runway. Every closed job compounds your trajectory.";
  }

  return { score, explanation };
}

export function computeCeoScoreboard(
  context: OperatingContext,
  snapshot: OperatingSnapshot = computeOperatingSnapshot(context),
): CeoScoreboard {
  const nextArr = getNextArrMilestone(snapshot.lifetimeArr);
  const arrTarget = nextArr?.target ?? ARR_MILESTONE_LADDER[ARR_MILESTONE_LADDER.length - 1];
  const arrLabel = nextArr
    ? formatArrMilestoneLabel(nextArr.target)
    : "$1M+ ARR";

  const health = computeBusinessHealth(snapshot, context);

  return {
    revenueCollected: snapshot.monthlyRevenueCollected,
    arrGenerated: snapshot.monthlyArrGenerated,
    monthlySalesPerformance: snapshot.monthlySalesPerformance,
    lifetimeRevenue: snapshot.lifetimeRevenue,
    lifetimeArr: snapshot.lifetimeArr,
    homesProtected: snapshot.homesProtected,
    membersProtected: snapshot.membersProtected,
    arrProgress: {
      label: `Progress to ${arrLabel}`,
      current: snapshot.lifetimeArr,
      target: arrTarget,
      progress: clampProgress(snapshot.lifetimeArr, arrTarget),
    },
    monthlyGoalProgress: {
      label: "Monthly Goal Progress",
      current: snapshot.monthlySalesPerformance,
      target: DEFAULT_MONTHLY_SALES_GOAL,
      progress: clampProgress(
        snapshot.monthlySalesPerformance,
        DEFAULT_MONTHLY_SALES_GOAL,
      ),
    },
    businessHealthScore: health.score,
    businessHealthExplanation: health.explanation,
  };
}
