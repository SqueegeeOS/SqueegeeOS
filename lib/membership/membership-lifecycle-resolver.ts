import type { MembershipStatus } from "@/lib/persistence/types/membership";

/** Normalized lifecycle state — one result for every surface. */
export type MembershipLifecycleState =
  | "draft"
  | "agreement_pending"
  | "payment_pending"
  | "activation_pending"
  | "active"
  | "past_due"
  | "paused"
  | "canceled"
  | "inconsistent";

export interface MembershipLifecycleInput {
  status: string;
  payment_setup_completed_at?: string | null;
  stripe_payment_method_id?: string | null;
  stripe_customer_id?: string | null;
  agreement_id?: string | null;
  sales_tier?: string | null;
  visit_price?: number | null;
  visits_per_year?: number | null;
  /** signed_agreements.status when known */
  signedAgreementStatus?: string | null;
  /** presentations.status when known */
  presentationStatus?: string | null;
  /** presentations.onboarding_status when known */
  onboardingStatus?: string | null;
  /** ISO datetime of next scheduled appointment */
  nextScheduledAt?: string | null;
  /** Billing workspace signal */
  pastDue?: boolean;
  /** Tier on signed agreement when cross-checking */
  agreementSalesTier?: string | null;
  agreementVisitPrice?: number | null;
}

export interface MembershipLifecycleResult {
  state: MembershipLifecycleState;
  rawStatus: MembershipStatus;
  isActive: boolean;
  paymentOnFile: boolean;
  hasPaymentSignal: boolean;
  hasSignedAgreement: boolean;
  canSchedule: boolean;
  canBill: boolean;
  inconsistencies: string[];
}

const KNOWN_STATUSES = new Set<MembershipStatus>([
  "inactive",
  "pending_checkout",
  "pending_payment",
  "active",
  "paused",
  "cancelled",
]);

function normalizeRawStatus(status: string): MembershipStatus {
  if (KNOWN_STATUSES.has(status as MembershipStatus)) {
    return status as MembershipStatus;
  }
  return "inactive";
}

export function hasPaymentSignal(input: MembershipLifecycleInput): boolean {
  return Boolean(
    input.payment_setup_completed_at?.trim() ||
      input.stripe_payment_method_id?.trim(),
  );
}

/** Strict: payment setup completed timestamp (activation write). */
export function hasPaymentMethodOnFile(input: MembershipLifecycleInput): boolean {
  return Boolean(input.payment_setup_completed_at?.trim());
}

export function hasSignedAgreementRecord(input: MembershipLifecycleInput): boolean {
  if (input.signedAgreementStatus === "complete") return true;
  if (input.agreement_id?.trim()) {
    return input.signedAgreementStatus !== "pending";
  }
  return Boolean(
    input.presentationStatus === "signed" && input.agreement_id?.trim(),
  );
}

function detectInconsistencies(input: MembershipLifecycleInput): string[] {
  const issues: string[] = [];
  const raw = normalizeRawStatus(input.status);

  if (raw === "active" && !hasPaymentMethodOnFile(input)) {
    issues.push("status_active_without_payment_setup_completed_at");
  }
  if (hasPaymentMethodOnFile(input) && raw === "pending_payment") {
    issues.push("payment_completed_while_status_pending_payment");
  }
  if (
    input.agreementSalesTier &&
    input.sales_tier &&
    input.agreementSalesTier !== input.sales_tier
  ) {
    issues.push("tier_mismatch_membership_vs_agreement");
  }
  if (
    input.agreementVisitPrice != null &&
    input.visit_price != null &&
    Math.abs(input.agreementVisitPrice - input.visit_price) > 0.01
  ) {
    issues.push("visit_price_mismatch_membership_vs_agreement");
  }
  if (raw === "active" && input.agreement_id !== undefined && !input.agreement_id?.trim()) {
    issues.push("active_without_agreement_id");
  }
  if (
    raw === "active" &&
    input.sales_tier !== undefined &&
    !input.sales_tier?.trim()
  ) {
    issues.push("active_without_tier_or_visit_price");
  }
  if (
    raw === "active" &&
    input.visit_price !== undefined &&
    input.visit_price == null
  ) {
    issues.push("active_without_tier_or_visit_price");
  }

  return issues;
}

/** Strict active — scheduling, billing, portal active badge. */
export function isMembershipActive(input: MembershipLifecycleInput): boolean {
  const raw = normalizeRawStatus(input.status);
  if (raw !== "active") return false;
  if (!hasPaymentMethodOnFile(input)) return false;
  if (input.agreement_id !== undefined && !input.agreement_id?.trim()) {
    return false;
  }
  if (input.sales_tier !== undefined && !input.sales_tier?.trim()) {
    return false;
  }
  if (input.visit_price !== undefined && input.visit_price == null) {
    return false;
  }
  return true;
}

export function resolveMembershipLifecycle(
  input: MembershipLifecycleInput,
): MembershipLifecycleResult {
  const rawStatus = normalizeRawStatus(input.status);
  const inconsistencies = detectInconsistencies(input);
  const paymentOnFile = hasPaymentMethodOnFile(input);
  const paymentSignal = hasPaymentSignal(input);
  const signedAgreement = hasSignedAgreementRecord(input);
  const active = isMembershipActive(input);

  let state: MembershipLifecycleState;

  if (inconsistencies.length > 0) {
    state = "inconsistent";
  } else if (rawStatus === "paused") {
    state = "paused";
  } else if (rawStatus === "cancelled") {
    state = "canceled";
  } else if (active) {
    state = input.pastDue ? "past_due" : "active";
  } else if (paymentSignal && rawStatus !== "active") {
    state = "activation_pending";
  } else if (signedAgreement || rawStatus === "pending_payment") {
    state = paymentSignal ? "activation_pending" : "payment_pending";
  } else if (
    input.presentationStatus &&
    input.presentationStatus !== "signed"
  ) {
    state = "agreement_pending";
  } else if (input.onboardingStatus === "pending_payment") {
    state = "payment_pending";
  } else if (input.agreement_id || input.presentationStatus === "signed") {
    state = "payment_pending";
  } else {
    state = "draft";
  }

  return {
    state,
    rawStatus,
    isActive: active,
    paymentOnFile,
    hasPaymentSignal: paymentSignal,
    hasSignedAgreement: signedAgreement,
    canSchedule: active,
    canBill: active,
    inconsistencies,
  };
}
