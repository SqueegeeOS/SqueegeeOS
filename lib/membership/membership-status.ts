import type { StripePaymentStatus } from "@/lib/admin/billing-workspace-types";
import {
  hasPaymentMethodOnFile as lifecyclePaymentOnFile,
  hasPaymentSignal as lifecyclePaymentSignal,
  isMembershipActive as lifecycleIsActive,
  resolveMembershipLifecycle,
  type MembershipLifecycleInput,
} from "@/lib/membership/membership-lifecycle-resolver";

/**
 * Canonical membership state — thin adapters over membership-lifecycle-resolver.
 * Import from this module in HQ, portal, scheduling, and billing surfaces.
 */
export interface MembershipStatusFields {
  status: string;
  payment_setup_completed_at: string | null;
  stripe_payment_method_id?: string | null;
  stripe_customer_id?: string | null;
}

/** HQ /hq/memberships row status — operational, not raw DB status. */
export type HqMembershipDisplayStatus =
  | "active"
  | "scheduled"
  | "needs card"
  | "needs scheduling"
  | "signed"
  | "attention"
  | "cancelled";

export interface HqMembershipStatusInput extends MembershipStatusFields {
  agreement_id?: string | null;
  sales_tier?: string | null;
  visit_price?: number | null;
  visits_per_year?: number | null;
  /** ISO datetime of the next scheduled appointment, when known. */
  nextScheduledAt?: string | null;
}

/** Portal-facing coarse status on MemberProfile. */
export type PortalMembershipStatus = "active" | "inactive" | "cancelled";

export type { MembershipLifecycleState, MembershipLifecycleResult } from "./membership-lifecycle-resolver";
export {
  resolveMembershipLifecycle,
  type MembershipLifecycleInput,
} from "./membership-lifecycle-resolver";

function toLifecycleInput(
  m: MembershipStatusFields &
    Partial<
      Pick<
        HqMembershipStatusInput,
        | "agreement_id"
        | "sales_tier"
        | "visit_price"
        | "visits_per_year"
        | "nextScheduledAt"
      >
    >,
): MembershipLifecycleInput {
  return {
    status: m.status,
    payment_setup_completed_at: m.payment_setup_completed_at,
    stripe_payment_method_id: m.stripe_payment_method_id,
    stripe_customer_id: m.stripe_customer_id,
    agreement_id: m.agreement_id,
    sales_tier: m.sales_tier,
    visit_price: m.visit_price,
    visits_per_year: m.visits_per_year,
    nextScheduledAt: m.nextScheduledAt,
  };
}

export function hasPaymentSignal(m: MembershipStatusFields): boolean {
  return lifecyclePaymentSignal(toLifecycleInput(m));
}

export function hasPaymentMethodOnFile(m: MembershipStatusFields): boolean {
  return lifecyclePaymentOnFile(toLifecycleInput(m));
}

export function isMembershipCancelled(
  m: Pick<MembershipStatusFields, "status">,
): boolean {
  return m.status === "cancelled" || m.status === "paused";
}

export function isMembershipActive(
  m: MembershipStatusFields &
    Partial<Pick<HqMembershipStatusInput, "agreement_id" | "sales_tier" | "visit_price">>,
): boolean {
  return lifecycleIsActive(toLifecycleInput(m));
}

export function canScheduleMembership(
  m: MembershipStatusFields &
    Partial<Pick<HqMembershipStatusInput, "agreement_id" | "sales_tier" | "visit_price">>,
): boolean {
  return isMembershipActive(m);
}

export function canBillMembership(
  m: MembershipStatusFields &
    Partial<Pick<HqMembershipStatusInput, "agreement_id" | "sales_tier" | "visit_price">>,
): boolean {
  return isMembershipActive(m);
}

export function resolvePortalMembershipStatus(
  m: MembershipStatusFields &
    Partial<Pick<HqMembershipStatusInput, "agreement_id" | "sales_tier" | "visit_price">>,
): PortalMembershipStatus {
  if (isMembershipCancelled(m)) return "cancelled";
  return isMembershipActive(m) ? "active" : "inactive";
}

/** Unified HQ memberships table status. */
export function resolveHqMembershipDisplayStatus(
  m: HqMembershipStatusInput,
): HqMembershipDisplayStatus {
  const lifecycle = resolveMembershipLifecycle(toLifecycleInput(m));

  if (lifecycle.state === "canceled" || lifecycle.state === "paused") {
    return "cancelled";
  }
  if (lifecycle.state === "inconsistent") return "attention";

  if (lifecycle.isActive) {
    return m.nextScheduledAt ? "scheduled" : "needs scheduling";
  }

  if (lifecycle.state === "payment_pending" || lifecycle.state === "draft") {
    return "needs card";
  }
  if (lifecycle.state === "activation_pending") {
    return m.status === "pending_payment" ? "signed" : "attention";
  }
  if (lifecycle.state === "agreement_pending") return "signed";
  if (lifecycle.state === "past_due") return "attention";

  return "attention";
}

/** HQ command-center pending-member reason — derived from lifecycle, not raw status. */
export type MembershipPendingReason =
  | "signed_missing_card"
  | "card_not_active"
  | "agreement_not_signed";

export function resolvePendingMemberReason(
  m: MembershipStatusFields &
    Partial<Pick<HqMembershipStatusInput, "agreement_id">>,
  options?: { hasSignedAgreement?: boolean },
): MembershipPendingReason | null {
  const hasSignedAgreement = options?.hasSignedAgreement ?? false;
  const lifecycle = resolveMembershipLifecycle({
    ...toLifecycleInput(m),
    signedAgreementStatus: hasSignedAgreement ? "complete" : undefined,
  });

  if (lifecycle.isActive) return null;
  if (lifecycle.state === "canceled" || lifecycle.state === "paused") return null;

  const hasAgreement =
    Boolean(m.agreement_id?.trim()) || hasSignedAgreement;
  const paymentOnFile = lifecycle.paymentOnFile;

  if (hasAgreement && !paymentOnFile) {
    return "signed_missing_card";
  }
  if (paymentOnFile && !lifecycle.isActive) {
    return "card_not_active";
  }
  if (
    lifecycle.state === "payment_pending" ||
    lifecycle.state === "agreement_pending" ||
    lifecycle.state === "draft"
  ) {
    if (!hasAgreement) return null;
    return "signed_missing_card";
  }
  if (lifecycle.state === "activation_pending") {
    return "card_not_active";
  }
  return null;
}

/** Pre-active enrollment states (signed path, not yet strict-active). */
export function isMembershipPendingEnrollment(
  m: MembershipStatusFields &
    Partial<Pick<HqMembershipStatusInput, "agreement_id">>,
  options?: { hasSignedAgreement?: boolean; onboardingStatus?: string | null },
): boolean {
  if (isMembershipCancelled(m)) return false;
  const lifecycle = resolveMembershipLifecycle({
    ...toLifecycleInput(m),
    signedAgreementStatus: options?.hasSignedAgreement ? "complete" : undefined,
    onboardingStatus: options?.onboardingStatus ?? undefined,
  });
  if (lifecycle.isActive) return false;
  return (
    lifecycle.state === "payment_pending" ||
    lifecycle.state === "activation_pending" ||
    lifecycle.state === "agreement_pending" ||
    options?.onboardingStatus === "pending_payment"
  );
}

export function resolveStripePaymentStatus(
  m: MembershipStatusFields,
): StripePaymentStatus {
  if (m.stripe_payment_method_id && m.payment_setup_completed_at) {
    return "card_on_file";
  }
  if (m.stripe_customer_id) {
    return "customer_only";
  }
  if (
    (m.status === "active" || m.status === "pending_payment") &&
    !m.payment_setup_completed_at
  ) {
    return "payment_pending";
  }
  return "not_configured";
}
