export const GROWTH_TARGET_ARR = 240_000;
export const GROWTH_TARGET_DATE = "2028-12-31";
export const LONG_TERM_ARR_VISION = 10_000_000;

export interface GrowthTruthSnapshot {
  generatedAt: string;
  source: "supabase" | "unavailable";
  currentActiveArr: number;
  onBookArr: number;
  arrAddedLast30Days: number;
  activeMembers: number;
  membersOnBook: number;
  cardOnFileCount: number;
  leadsLast30Days: number;
  signedMembersLast30Days: number;
  directionalCloseRate: number | null;
  averageMemberArr: number | null;
  openLeads: number;
  draftPresentations: number;
  presentedNotSigned: number;
  sourceMix: {
    website: number;
    facebook: number;
  };
  warnings: string[];
}

export interface GrowthScenarioInput {
  currentArr: number;
  targetArr: number;
  targetDate: string;
  averageMemberArr: number;
  leadsPerWeek: number;
  closeRatePercent: number;
  annualRetentionPercent: number;
  referenceDate?: string;
}

export interface GrowthScenarioResult {
  monthsRemaining: number;
  weeksRemaining: number;
  arrGap: number;
  requiredNetArrPerMonth: number;
  requiredGrossArrPerMonth: number;
  requiredMembersPerMonth: number;
  requiredLeadsPerWeek: number | null;
  requiredCloseRatePercent: number | null;
  modeledMembersPerMonth: number;
  modeledNewArrPerMonth: number;
  modeledGrossArrAdded: number;
  retainedCurrentArrAtTarget: number;
  retainedNewArrAtTarget: number;
  modeledRetentionDrag: number;
  leadPaceDeltaPerWeek: number | null;
  projectedArrAtTargetDate: number;
  projectedTargetPercent: number;
  onTrack: boolean;
}

export const WEEKS_PER_YEAR = 365.2425 / 7;
const MILLISECONDS_PER_WEEK = 7 * 24 * 60 * 60 * 1_000;

function positive(value: number, fallback = 0): number {
  return Number.isFinite(value) ? Math.max(0, value) : fallback;
}

export function monthsThroughDate(
  referenceDate: string | Date,
  targetDate: string | Date,
): number {
  const start = new Date(referenceDate);
  const end = new Date(targetDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    end.getUTCMonth() -
    start.getUTCMonth() +
    (end.getUTCDate() >= start.getUTCDate() ? 1 : 0);
  return Math.max(0, months);
}

export function weeksThroughDate(
  referenceDate: string | Date,
  targetDate: string | Date,
): number {
  const start = new Date(referenceDate);
  const end = new Date(targetDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(0, (end.getTime() - start.getTime()) / MILLISECONDS_PER_WEEK);
}

export function calculateGrowthScenario(
  input: GrowthScenarioInput,
): GrowthScenarioResult {
  const currentArr = positive(input.currentArr);
  const targetArr = positive(input.targetArr);
  const averageMemberArr = Math.max(1, positive(input.averageMemberArr, 1));
  const closeRate = Math.min(1, positive(input.closeRatePercent) / 100);
  const retention = Math.min(1, positive(input.annualRetentionPercent) / 100);
  const weeksRemaining = weeksThroughDate(
    input.referenceDate ?? new Date(),
    input.targetDate,
  );
  const monthsRemaining = (weeksRemaining * 12) / WEEKS_PER_YEAR;
  const arrGap = Math.max(0, targetArr - currentArr);
  const requiredNetArrPerMonth =
    monthsRemaining > 0 ? arrGap / monthsRemaining : arrGap;
  const weeklyRetention =
    retention > 0 ? Math.pow(retention, 1 / WEEKS_PER_YEAR) : 0;
  const retainedCurrentArrAtTarget =
    weeksRemaining > 0
      ? currentArr * Math.pow(weeklyRetention, weeksRemaining)
      : currentArr;
  const contributionFactor =
    weeksRemaining <= 0
      ? 0
      : Math.abs(weeklyRetention - 1) < 1e-9
        ? weeksRemaining
        : (1 - Math.pow(weeklyRetention, weeksRemaining)) /
          (1 - weeklyRetention);
  const requiredGrossArrPerWeek =
    contributionFactor > 0
      ? Math.max(0, targetArr - retainedCurrentArrAtTarget) / contributionFactor
      : Math.max(0, targetArr - retainedCurrentArrAtTarget);
  const requiredGrossArrPerMonth =
    requiredGrossArrPerWeek * (WEEKS_PER_YEAR / 12);
  const requiredMembersPerMonth = requiredGrossArrPerMonth / averageMemberArr;
  const requiredLeadsPerWeek =
    requiredGrossArrPerWeek <= 0
      ? 0
      : closeRate > 0
        ? requiredGrossArrPerWeek / averageMemberArr / closeRate
        : null;
  const leadsPerWeek = positive(input.leadsPerWeek);
  const requiredCloseRatePercent =
    requiredGrossArrPerWeek <= 0
      ? 0
      : leadsPerWeek > 0
        ? (requiredGrossArrPerWeek / (leadsPerWeek * averageMemberArr)) * 100
        : null;
  const modeledMembersPerMonth =
    leadsPerWeek * (WEEKS_PER_YEAR / 12) * closeRate;
  const modeledNewArrPerMonth = modeledMembersPerMonth * averageMemberArr;
  const modeledNewArrPerWeek = leadsPerWeek * closeRate * averageMemberArr;
  const modeledGrossArrAdded = modeledNewArrPerWeek * weeksRemaining;
  const retainedNewArrAtTarget = modeledNewArrPerWeek * contributionFactor;
  const projectedArr = retainedCurrentArrAtTarget + retainedNewArrAtTarget;
  const modeledRetentionDrag = Math.max(
    0,
    currentArr + modeledGrossArrAdded - projectedArr,
  );
  const leadPaceDeltaPerWeek =
    requiredLeadsPerWeek == null ? null : leadsPerWeek - requiredLeadsPerWeek;

  return {
    monthsRemaining,
    weeksRemaining,
    arrGap,
    requiredNetArrPerMonth,
    requiredGrossArrPerMonth,
    requiredMembersPerMonth,
    requiredLeadsPerWeek,
    requiredCloseRatePercent,
    modeledMembersPerMonth,
    modeledNewArrPerMonth,
    modeledGrossArrAdded,
    retainedCurrentArrAtTarget,
    retainedNewArrAtTarget,
    modeledRetentionDrag,
    leadPaceDeltaPerWeek,
    projectedArrAtTargetDate: projectedArr,
    projectedTargetPercent:
      targetArr > 0 ? Math.min(999, (projectedArr / targetArr) * 100) : 100,
    onTrack: targetArr > 0 && projectedArr >= targetArr,
  };
}

export type GrowthInitiativeHorizon = "now" | "next" | "later";

export interface GrowthInitiative {
  id: string;
  horizon: GrowthInitiativeHorizon;
  title: string;
  outcome: string;
  owner:
    | "Founder"
    | "Founder + David"
    | "HomeAtlas"
    | "Growth Team"
    | "Field Team"
    | "Founder + Field Team";
  impact: "Critical" | "High" | "Medium";
}

export const GROWTH_INITIATIVES: GrowthInitiative[] = [
  {
    id: "jarad-independent-day",
    horizon: "now",
    title: "Jarad's first independent field day",
    outcome: "One complete normal route runs from verified scope through closeout without Noah physically present.",
    owner: "Founder + Field Team",
    impact: "Critical",
  },
  {
    id: "owner-time-buyback",
    horizon: "now",
    title: "First 8 owner hours bought back",
    outcome: "Count only normal, documented, quality-verified production with zero owner involvement.",
    owner: "Founder + Field Team",
    impact: "Critical",
  },
  {
    id: "growth-hours-discipline",
    horizon: "now",
    title: "Convert bought-back time into Growth Hours",
    outcome: "Noah and Dasan time every deliberate growth block by operator and channel, then close it with a result note.",
    owner: "Growth Team",
    impact: "Critical",
  },
  {
    id: "owner-arr-attribution",
    horizon: "now",
    title: "Signed ARR per Growth Hour",
    outcome: "Every owner-led presentation carries stable lineage through the signed agreement and membership ARR snapshot.",
    owner: "Growth Team",
    impact: "Critical",
  },
  {
    id: "signup-reliability",
    horizon: "now",
    title: "Zero-friction signup reliability",
    outcome: "Every field survives draft, address, plan, signature, payment, and portal activation.",
    owner: "HomeAtlas",
    impact: "Critical",
  },
  {
    id: "jobber-visit-truth",
    horizon: "now",
    title: "Jobber route and scope truth",
    outcome: "Every assigned technician sees verified timing, service scope, property memory, and the exact exception needing HQ.",
    owner: "HomeAtlas",
    impact: "Critical",
  },
  {
    id: "visit-proof",
    horizon: "now",
    title: "Visit proof that compounds trust",
    outcome: "Photos, notes, completion, and follow-up land on one property timeline after every visit.",
    owner: "HomeAtlas",
    impact: "High",
  },
  {
    id: "source-attribution",
    horizon: "next",
    title: "Lead-source attribution",
    outcome: "Website, Facebook, Google, referral, and D2D leads stay labeled through signed ARR.",
    owner: "HomeAtlas",
    impact: "High",
  },
  {
    id: "david-field-mode",
    horizon: "next",
    title: "David sunlight field mode",
    outcome: "One-thumb doors, conversations, follow-ups, presentations, and auto-attributed closes.",
    owner: "Founder + David",
    impact: "High",
  },
  {
    id: "follow-up-machine",
    horizon: "next",
    title: "Permission-aware follow-up machine",
    outcome: "Every lead has a next action, due date, owner, and visible message history.",
    owner: "HomeAtlas",
    impact: "High",
  },
  {
    id: "review-flywheel",
    horizon: "next",
    title: "Review flywheel",
    outcome: "Request a Google review after a successful visit and show fresh proof on the public site.",
    owner: "HomeAtlas",
    impact: "High",
  },
  {
    id: "referral-loop",
    horizon: "next",
    title: "Member referral loop",
    outcome: "Give members a simple share link and track referred leads through activation.",
    owner: "HomeAtlas",
    impact: "High",
  },
  {
    id: "churn-rescue",
    horizon: "next",
    title: "Churn and payment rescue",
    outcome: "Flag service, card, and cancellation risk before ARR quietly disappears.",
    owner: "HomeAtlas",
    impact: "High",
  },
  {
    id: "capacity-forecast",
    horizon: "next",
    title: "30/60/90-day capacity forecast",
    outcome: "Know when recurring work requires a helper, route change, or first technician hire.",
    owner: "Founder",
    impact: "High",
  },
  {
    id: "addon-intelligence",
    horizon: "next",
    title: "Relevant add-on intelligence",
    outcome: "Surface pressure washing, cobweb, gutter, and screen opportunities from real property history.",
    owner: "HomeAtlas",
    impact: "Medium",
  },
  {
    id: "territory-learning",
    horizon: "later",
    title: "Territory learning map",
    outcome: "Compare doors, conversations, signed ARR, density, and retention by neighborhood.",
    owner: "Founder + David",
    impact: "High",
  },
  {
    id: "commission-ledger",
    horizon: "later",
    title: "Auditable sales compensation ledger",
    outcome: "Track front-end, back-end, residual, reversals, vesting, and special David terms without ambiguity.",
    owner: "HomeAtlas",
    impact: "High",
  },
  {
    id: "pricing-learning",
    horizon: "later",
    title: "Pricing learning system",
    outcome: "Measure close rate, margin, retention, and capacity by offer before changing company pricing.",
    owner: "Founder",
    impact: "Medium",
  },
  {
    id: "crew-operating-system",
    horizon: "later",
    title: "Crew operating system",
    outcome: "Turn property truth into routes, proof of work, quality checks, payroll evidence, and callbacks.",
    owner: "HomeAtlas",
    impact: "High",
  },
  {
    id: "market-playbook",
    horizon: "later",
    title: "Replicable market playbook",
    outcome: "Document the local acquisition, service, retention, staffing, and unit-economics recipe before expansion.",
    owner: "Founder",
    impact: "High",
  },
];

export const GROWTH_LADDER = [
  {
    range: "$0-$50K ARR",
    title: "Prove the founder machine",
    focus: "Reliable signup, dense routes, fast follow-up, strong reviews, and clean records.",
  },
  {
    range: "$50K-$240K ARR",
    title: "Build the local recurring engine",
    focus: "One dependable sales motion, first field capacity, billing discipline, and retention.",
  },
  {
    range: "$240K-$1M ARR",
    title: "Systemize crews and territories",
    focus: "Role clarity, route economics, quality control, sales management, and predictable hiring.",
  },
  {
    range: "$1M-$3M ARR",
    title: "Create a multi-territory company",
    focus: "Market playbooks, leaders, centralized support, and location-level P&Ls.",
  },
  {
    range: "$3M-$10M ARR",
    title: "Operate a durable platform",
    focus: "Brand, data, finance, leadership depth, defensible retention, and expansion discipline.",
  },
] as const;
