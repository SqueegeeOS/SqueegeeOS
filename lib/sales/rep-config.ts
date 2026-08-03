export type SalesRepPlan = "founding_david" | "standard_commission";

export interface SalesRepBenefit {
  title: string;
  detail: string;
}

export interface SalesRepMilestone {
  retainedMembers: number;
  modeledEquityPercent: number;
}

export interface SalesRepProfile {
  slug: string;
  displayName: string;
  roleTitle: string;
  workspacePath: string;
  plan: SalesRepPlan;
  planLabel: string;
  isFoundingRep: boolean;
  benefits: SalesRepBenefit[];
  milestones: SalesRepMilestone[];
  retentionQualificationMonths: number | null;
}

const DAVID_MILESTONES: SalesRepMilestone[] = [
  { retainedMembers: 25, modeledEquityPercent: 1 },
  { retainedMembers: 50, modeledEquityPercent: 2 },
  { retainedMembers: 75, modeledEquityPercent: 3 },
  { retainedMembers: 100, modeledEquityPercent: 4 },
  { retainedMembers: 125, modeledEquityPercent: 5 },
];

export const DAVID_REP_PROFILE: SalesRepProfile = {
  slug: "david",
  displayName: "David",
  roleTitle: "Founding Membership Advisor",
  workspacePath: "/david",
  plan: "founding_david",
  planLabel: "Founding rep track",
  isFoundingRep: true,
  benefits: [
    {
      title: "Front-end commission",
      detail: "Immediate earning potential for qualified memberships he closes.",
    },
    {
      title: "Back-end quality commission",
      detail: "A later reward layer tied to customers that stay healthy and active.",
    },
    {
      title: "Year-two residual eligibility",
      detail: "A small renewal-style residual can begin after the first full retained year.",
    },
    {
      title: "Founder equity milestones",
      detail: "Private progress modeling reserved for David and subject to a signed legal agreement.",
    },
  ],
  milestones: DAVID_MILESTONES,
  retentionQualificationMonths: 12,
};

export const STANDARD_REP_PROFILE: Omit<
  SalesRepProfile,
  "slug" | "displayName" | "workspacePath"
> = {
  roleTitle: "Membership Advisor",
  plan: "standard_commission",
  planLabel: "Standard commission track",
  isFoundingRep: false,
  benefits: [
    {
      title: "Standard sales commission",
      detail: "Commission terms are assigned by the company for each representative.",
    },
  ],
  milestones: [],
  retentionQualificationMonths: null,
};

export function profileForKnownRep(slug: string): SalesRepProfile | null {
  return slug.trim().toLowerCase() === DAVID_REP_PROFILE.slug
    ? DAVID_REP_PROFILE
    : null;
}

export function buildStandardRepProfile(input: {
  slug: string;
  displayName: string;
  roleTitle?: string | null;
}): SalesRepProfile {
  const slug = input.slug.trim().toLowerCase();
  return {
    ...STANDARD_REP_PROFILE,
    slug,
    displayName: input.displayName.trim(),
    roleTitle: input.roleTitle?.trim() || STANDARD_REP_PROFILE.roleTitle,
    workspacePath: `/sales/${encodeURIComponent(slug)}`,
  };
}

export function getMilestoneProgress(
  profile: SalesRepProfile,
  qualifiedRetainedMembers: number,
): {
  modeledEquityPercent: number;
  nextMilestone: SalesRepMilestone | null;
  progressPercent: number;
} {
  const count = Math.max(0, Math.floor(qualifiedRetainedMembers));
  let modeledEquityPercent = 0;
  let previousThreshold = 0;
  let nextMilestone: SalesRepMilestone | null = null;

  for (const milestone of profile.milestones) {
    if (count >= milestone.retainedMembers) {
      modeledEquityPercent = milestone.modeledEquityPercent;
      previousThreshold = milestone.retainedMembers;
      continue;
    }
    nextMilestone = milestone;
    break;
  }

  if (!nextMilestone) {
    return {
      modeledEquityPercent,
      nextMilestone: null,
      progressPercent: profile.milestones.length > 0 ? 100 : 0,
    };
  }

  const interval = Math.max(1, nextMilestone.retainedMembers - previousThreshold);
  return {
    modeledEquityPercent,
    nextMilestone,
    progressPercent: Math.min(
      100,
      Math.max(0, ((count - previousThreshold) / interval) * 100),
    ),
  };
}
