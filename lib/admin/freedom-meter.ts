import type { BusinessLedger } from "./growth-journey";
import { DEFAULT_MONTHLY_SALES_GOAL } from "./growth-journey";
import type { OperatingContext } from "./growth-journey";
import { computeGrowthJourney } from "./growth-journey";

export interface FreedomMeter {
  score: number;
  label: string;
  explanation: string;
  dimensions: Array<{ label: string; progress: number }>;
}

/**
 * Freedom measures how much the company runs on systems and recurring value
 * versus fighting month-to-month. Not escape — intentional building.
 */
export function computeFreedomMeter(
  context: OperatingContext,
  ledger: BusinessLedger,
): FreedomMeter {
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
    totalMilestones > 0 ? (achievedMilestones / totalMilestones) * 100 : 0;

  const company = ledger.company;
  const os = ledger.operatingSystem;

  const recurringFreedom =
    company.lifetimeRevenue > 0
      ? Math.min(100, (company.lifetimeArr / company.lifetimeRevenue) * 100)
      : 0;

  const membershipFreedom = Math.min(100, (company.membersProtected / 50) * 100);

  const monthlyFreedom = Math.min(
    100,
    (os.monthlySalesPerformance / DEFAULT_MONTHLY_SALES_GOAL) * 100,
  );

  const systemsFreedom = Math.min(100, os.closedJobsCount * 8);

  const rawScore =
    journeyProgress * 0.3 +
    recurringFreedom * 0.28 +
    membershipFreedom * 0.22 +
    monthlyFreedom * 0.12 +
    systemsFreedom * 0.08;

  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  let label: string;
  let explanation: string;

  if (score >= 80) {
    label = "Building on purpose";
    explanation =
      "Recurring revenue, systems, and milestones are compounding. Keep protecting what you've built.";
  } else if (score >= 55) {
    label = "Gaining ground";
    explanation =
      "Momentum is real. Every membership and logged job moves you toward a company that runs with intention.";
  } else if (score >= 30) {
    label = "Laying foundation";
    explanation =
      "Freedom isn't escape — it's building systems that outlast any single month. Stay consistent.";
  } else {
    label = "Early chapter";
    explanation =
      "The Operating System era has begun. Recurring customers and logged sales are how freedom is earned.";
  }

  return {
    score,
    label,
    explanation,
    dimensions: [
      { label: "Growth journey", progress: Math.round(journeyProgress) },
      { label: "Recurring value", progress: Math.round(recurringFreedom) },
      { label: "Membership base", progress: Math.round(membershipFreedom) },
      { label: "Monthly momentum", progress: Math.round(monthlyFreedom) },
    ],
  };
}
