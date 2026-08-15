import {
  hasPaymentMethodOnFile,
  isMembershipActive,
  type HqMembershipStatusInput,
} from "@/lib/membership/membership-status";
import { ROUTES } from "@/lib/navigation/config";

export const SALES_PRODUCTION_HANDOFF_STAGES = [
  "payment_needed",
  "membership_attention",
  "property_pairing_needed",
  "job_pairing_needed",
  "source_unavailable",
  "schedule_needed",
  "ready",
] as const;

export type SalesProductionHandoffStage =
  (typeof SALES_PRODUCTION_HANDOFF_STAGES)[number];

export type SalesProductionScheduleSourceState = "fresh" | "unavailable";

export interface SalesProductionHandoffMembership
  extends HqMembershipStatusInput {
  id: string;
  homeowner_id: string;
  property_id: string;
}

export interface SalesProductionHandoffInput {
  attributionId: string;
  membershipId: string | null;
  homeownerName: string;
  propertyAddress: string;
  attributedArrCents: number;
  attributedAt: string;
  membership: SalesProductionHandoffMembership | null;
  propertyLinked: boolean;
  recurringJobCount: number;
  scheduleSourceState: SalesProductionScheduleSourceState;
  scheduleObservedAt: string | null;
  nextScheduledAt: string | null;
}

export interface SalesProductionHandoffRecord {
  attributionId: string;
  membershipId: string | null;
  homeownerName: string;
  propertyAddress: string;
  attributedArrCents: number;
  attributedAt: string;
  stage: SalesProductionHandoffStage;
  label: string;
  detail: string;
  completedSteps: number;
  totalSteps: 5;
  actionLabel: string;
  actionHref: string;
  nextScheduledAt: string | null;
  scheduleObservedAt: string | null;
}

export interface SalesProductionHandoffSnapshot {
  generatedAt: string;
  records: SalesProductionHandoffRecord[];
  summary: {
    signedCount: number;
    readyCount: number;
    actionCount: number;
    scheduleUnknownCount: number;
  };
}

function memberHref(membershipId: string | null): string {
  return membershipId
    ? ROUTES.hqCustomerWorkspace("membership", membershipId)
    : ROUTES.hqMembership;
}

function common(
  input: SalesProductionHandoffInput,
): Omit<
  SalesProductionHandoffRecord,
  | "stage"
  | "label"
  | "detail"
  | "completedSteps"
  | "actionLabel"
  | "actionHref"
> {
  return {
    attributionId: input.attributionId,
    membershipId: input.membershipId,
    homeownerName: input.homeownerName.trim() || "Signed homeowner",
    propertyAddress:
      input.propertyAddress.trim() || "Service property on file",
    attributedArrCents: Math.max(
      0,
      Number.isFinite(input.attributedArrCents)
        ? input.attributedArrCents
        : 0,
    ),
    attributedAt: input.attributedAt,
    totalSteps: 5,
    nextScheduledAt: input.nextScheduledAt,
    scheduleObservedAt: input.scheduleObservedAt,
  };
}

export function deriveSalesProductionHandoff(
  input: SalesProductionHandoffInput,
): SalesProductionHandoffRecord {
  const base = common(input);
  const membership = input.membership;

  if (!membership || membership.id !== input.membershipId) {
    return {
      ...base,
      stage: "membership_attention",
      label: "Member record review",
      detail:
        "The signed close does not resolve to one durable membership record. HQ must repair that lineage before production starts.",
      completedSteps: 1,
      actionLabel: "Review memberships",
      actionHref: ROUTES.hqMembership,
    };
  }

  if (!hasPaymentMethodOnFile(membership)) {
    return {
      ...base,
      stage: "payment_needed",
      label: "Payment setup needed",
      detail:
        "The agreement is signed, but payment setup is not complete enough to activate production.",
      completedSteps: 1,
      actionLabel: "Finish payment setup",
      actionHref: memberHref(membership.id),
    };
  }

  if (!isMembershipActive(membership)) {
    return {
      ...base,
      stage: "membership_attention",
      label: "Activation review",
      detail:
        "Payment evidence exists, but the membership lifecycle is not safely active. HQ must resolve the record before pairing work.",
      completedSteps: 2,
      actionLabel: "Review member record",
      actionHref: memberHref(membership.id),
    };
  }

  if (!input.propertyLinked) {
    return {
      ...base,
      stage: "property_pairing_needed",
      label: "Pair property",
      detail:
        "The membership is active. HQ still needs to pair its service property to the correct Jobber property.",
      completedSteps: 2,
      actionLabel: "Open Jobber pairing",
      actionHref: ROUTES.hqJobber,
    };
  }

  if (input.recurringJobCount < 1) {
    return {
      ...base,
      stage: "job_pairing_needed",
      label: "Link recurring job",
      detail:
        "The property is paired. HQ still needs to classify at least one recurring Jobber job for this membership.",
      completedSteps: 3,
      actionLabel: "Link recurring job",
      actionHref: ROUTES.hqJobber,
    };
  }

  if (input.scheduleSourceState !== "fresh") {
    return {
      ...base,
      stage: "source_unavailable",
      label: "Schedule unverified",
      detail:
        "The durable membership and Jobber links exist, but HomeAtlas cannot verify a current Jobber schedule right now.",
      completedSteps: 4,
      actionLabel: "Restore Jobber truth",
      actionHref: ROUTES.hqJobber,
    };
  }

  if (!input.nextScheduledAt) {
    return {
      ...base,
      stage: "schedule_needed",
      label: "Schedule first visit",
      detail:
        "Jobber data is current, but no upcoming visit exists on the linked recurring job.",
      completedSteps: 4,
      actionLabel: "Open member record",
      actionHref: memberHref(membership.id),
    };
  }

  return {
    ...base,
    stage: "ready",
    label: "Production ready",
    detail:
      "Agreement, payment readiness, property pairing, recurring-job classification, and an upcoming visit are all verified.",
    completedSteps: 5,
    actionLabel: "Open member record",
    actionHref: memberHref(membership.id),
  };
}

export function buildSalesProductionHandoffSnapshot(input: {
  records: SalesProductionHandoffRecord[];
  generatedAt: string;
}): SalesProductionHandoffSnapshot {
  const records = [...input.records].sort((left, right) => {
    const leftTime = new Date(left.attributedAt).getTime();
    const rightTime = new Date(right.attributedAt).getTime();
    const safeLeft = Number.isFinite(leftTime) ? leftTime : 0;
    const safeRight = Number.isFinite(rightTime) ? rightTime : 0;
    return safeRight !== safeLeft
      ? safeRight - safeLeft
      : left.attributionId.localeCompare(right.attributionId);
  });
  const readyCount = records.filter((record) => record.stage === "ready").length;
  const scheduleUnknownCount = records.filter(
    (record) => record.stage === "source_unavailable",
  ).length;

  return {
    generatedAt: input.generatedAt,
    records,
    summary: {
      signedCount: records.length,
      readyCount,
      actionCount: records.length - readyCount,
      scheduleUnknownCount,
    },
  };
}
