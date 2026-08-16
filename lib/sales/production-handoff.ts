import {
  hasPaymentMethodOnFile,
  isMembershipActive,
  type HqMembershipStatusInput,
} from "@/lib/membership/membership-status";
import type { PaymentSetupEmailState } from "@/lib/membership/payment-setup-email-state";
import type { PaymentHandoffProgress } from "@/lib/membership/payment-handoff-progress";
import { jobberHandoffHref } from "@/lib/care-operations/jobber-handoff-navigation";
import { ROUTES } from "@/lib/navigation/config";
import { presentationPresentPath } from "@/lib/presentations/navigation";

export const SALES_PRODUCTION_HANDOFF_STAGES = [
  "payment_needed",
  "payment_pending",
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
  presentation_id: string | null;
}

export interface SalesProductionHandoffInput {
  attributionId: string;
  membershipId: string | null;
  homeownerName: string;
  propertyAddress: string;
  attributedArrCents: number;
  attributedAt: string;
  membership: SalesProductionHandoffMembership | null;
  paymentSetupEmailState: PaymentSetupEmailState;
  paymentHandoffProgress: PaymentHandoffProgress;
  propertyLinked: boolean;
  recurringJobCount: number;
  scheduleSourceState: SalesProductionScheduleSourceState;
  scheduleObservedAt: string | null;
  nextScheduledAt: string | null;
}

export interface SalesProductionHandoffRecord {
  attributionId: string;
  membershipId: string | null;
  presentationId: string | null;
  homeownerName: string;
  propertyAddress: string;
  attributedArrCents: number;
  attributedAt: string;
  paymentSetupEmailState: PaymentSetupEmailState;
  paymentHandoffProgress: PaymentHandoffProgress;
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
    waitingCount: number;
    scheduleUnknownCount: number;
  };
}

function memberHref(membershipId: string | null): string {
  return membershipId
    ? ROUTES.hqCustomerWorkspace("membership", membershipId)
    : ROUTES.hqMembership;
}

function signedCloseHref(
  presentationId: string | null,
  membershipId: string | null,
): string {
  return presentationId
    ? presentationPresentPath(presentationId)
    : memberHref(membershipId);
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
    presentationId:
      input.membership?.id === input.membershipId
        ? input.membership.presentation_id
        : null,
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
    paymentSetupEmailState: input.paymentSetupEmailState,
    paymentHandoffProgress: input.paymentHandoffProgress,
    totalSteps: 5,
    nextScheduledAt: input.nextScheduledAt,
    scheduleObservedAt: input.scheduleObservedAt,
  };
}

function paymentRecoveryCopy(
  progress: PaymentHandoffProgress,
): { label: string; detail: string } {
  switch (progress.state) {
    case "expired":
      return {
        label: "Secure card link expired",
        detail:
          "The customer did not finish before the Stripe link expired. Reissue a fresh secure setup email; this still does not charge them.",
      };
    case "delivery_failed":
      return {
        label: "Payment email needs retry",
        detail:
          "The secure Stripe page is ready, but the email provider did not accept the last delivery. Retry the labeled email action.",
      };
    case "stalled":
      return {
        label: "Payment handoff stalled",
        detail:
          "The secure setup handoff did not finish preparing. Resume it from the signed close; HomeAtlas will reuse safe work when possible.",
      };
    default:
      return {
        label: "Payment setup needed",
        detail:
          "The signed agreement, customer email, and standing authorization are verified. Email the Stripe-hosted card setup link; this step does not charge the customer.",
      };
  }
}

function paymentSetupAttention(
  state: Exclude<PaymentSetupEmailState, "ready">,
): { label: string; detail: string; actionLabel: string } {
  switch (state) {
    case "card_on_file":
      return {
        label: "Payment evidence review",
        detail:
          "Payment-email proof says a card exists, but the membership record does not confirm it. HomeAtlas will not send another setup email until HQ resolves the mismatch.",
        actionLabel: "Review payment evidence",
      };
    case "needs_email":
      return {
        label: "Customer email needed",
        detail:
          "The agreement is signed, but HomeAtlas needs a valid customer email before it can send the secure Stripe setup link.",
        actionLabel: "Add customer email",
      };
    case "needs_agreement":
      return {
        label: "Signed agreement review",
        detail:
          "The close does not currently resolve to the completed presentation and agreement required for hosted card setup.",
        actionLabel: "Review signed agreement",
      };
    case "needs_authorization_review":
      return {
        label: "Billing authorization review",
        detail:
          "Standing billing authorization or signed-record lineage could not be proven, so HomeAtlas will not offer a payment email yet.",
        actionLabel: "Review authorization",
      };
    case "not_available":
      return {
        label: "Payment handoff review",
        detail:
          "This membership is not in a safe enrollment state for a hosted Stripe setup email.",
        actionLabel: "Review member record",
      };
  }
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
    if (input.paymentSetupEmailState !== "ready") {
      const attention = paymentSetupAttention(input.paymentSetupEmailState);
      return {
        ...base,
        stage: "membership_attention",
        label: attention.label,
        detail: attention.detail,
        completedSteps: 1,
        actionLabel: attention.actionLabel,
        actionHref: memberHref(membership.id),
      };
    }
    if (input.paymentHandoffProgress.state === "email_sent") {
      return {
        ...base,
        stage: "payment_pending",
        label: "Waiting on customer card setup",
        detail:
          "The email provider accepted the secure Stripe link. HomeAtlas is waiting for Stripe to confirm the saved card; no owner action is due while the link remains active.",
        completedSteps: 1,
        actionLabel: "Open signed close",
        actionHref: signedCloseHref(base.presentationId, membership.id),
      };
    }
    if (input.paymentHandoffProgress.state === "preparing") {
      return {
        ...base,
        stage: "payment_pending",
        label: "Preparing secure card handoff",
        detail:
          "HomeAtlas is preparing the Stripe-hosted setup email. Refresh shortly before attempting another action.",
        completedSteps: 1,
        actionLabel: "Open signed close",
        actionHref: signedCloseHref(base.presentationId, membership.id),
      };
    }
    if (input.paymentHandoffProgress.state === "completed") {
      return {
        ...base,
        stage: "membership_attention",
        label: "Payment evidence review",
        detail:
          "Stripe handoff evidence says setup completed, but the membership does not confirm a saved card. HQ must reconcile the records before production starts.",
        completedSteps: 1,
        actionLabel: "Review payment evidence",
        actionHref: memberHref(membership.id),
      };
    }
    if (input.paymentHandoffProgress.state === "review_required") {
      return {
        ...base,
        stage: "membership_attention",
        label: "Payment handoff review",
        detail:
          "The private Stripe handoff ledger needs review. HomeAtlas will not offer another customer email until HQ resolves the recorded mismatch.",
        completedSteps: 1,
        actionLabel: "Review payment evidence",
        actionHref: memberHref(membership.id),
      };
    }
    const recovery = paymentRecoveryCopy(input.paymentHandoffProgress);
    return {
      ...base,
      stage: "payment_needed",
      label: recovery.label,
      detail: recovery.detail,
      completedSteps: 1,
      actionLabel:
        input.paymentHandoffProgress.state === "not_started"
          ? "Open signed close"
          : "Recover payment handoff",
      actionHref: signedCloseHref(base.presentationId, membership.id),
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
      actionHref: jobberHandoffHref(membership.id, "property"),
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
      actionHref: jobberHandoffHref(membership.id, "job"),
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
  const waitingCount = records.filter(
    (record) => record.stage === "payment_pending",
  ).length;
  const scheduleUnknownCount = records.filter(
    (record) => record.stage === "source_unavailable",
  ).length;

  return {
    generatedAt: input.generatedAt,
    records,
    summary: {
      signedCount: records.length,
      readyCount,
      actionCount: records.length - readyCount - waitingCount,
      waitingCount,
      scheduleUnknownCount,
    },
  };
}
