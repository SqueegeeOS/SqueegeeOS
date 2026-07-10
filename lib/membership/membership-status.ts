import type { StripePaymentStatus } from "@/lib/admin/billing-workspace-types";

/**
 * Canonical membership state — the ONE definition every surface
 * (HQ overview, /hq/memberships, membership command center, billing
 * workspace, customer workspace, member portal, scheduling) must use.
 *
 * Two payment signals:
 * - `hasPaymentMethodOnFile` — strict (`payment_setup_completed_at` set).
 *   Use for active-member counts, billing eligibility, and scheduling.
 * - `hasPaymentSignal` — card captured but membership may not be active yet
 *   (`payment_setup_completed_at` OR `stripe_payment_method_id`). HQ display only.
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
  /** ISO datetime of the next scheduled appointment, when known. */
  nextScheduledAt?: string | null;
}

/** Portal-facing coarse status on MemberProfile. */
export type PortalMembershipStatus = "active" | "inactive" | "cancelled";

export function hasPaymentSignal(m: MembershipStatusFields): boolean {
  return Boolean(
    m.payment_setup_completed_at?.trim() ||
      m.stripe_payment_method_id?.trim(),
  );
}

export function hasPaymentMethodOnFile(m: MembershipStatusFields): boolean {
  return Boolean(m.payment_setup_completed_at?.trim());
}

export function isMembershipCancelled(
  m: Pick<MembershipStatusFields, "status">,
): boolean {
  return m.status === "cancelled" || m.status === "paused";
}

/** The one true "active member" test — use for counts, billing, and scheduling. */
export function isMembershipActive(m: MembershipStatusFields): boolean {
  return m.status === "active" && hasPaymentMethodOnFile(m);
}

export function canScheduleMembership(m: MembershipStatusFields): boolean {
  return isMembershipActive(m);
}

export function canBillMembership(m: MembershipStatusFields): boolean {
  return isMembershipActive(m);
}

export function resolvePortalMembershipStatus(
  m: MembershipStatusFields,
): PortalMembershipStatus {
  if (isMembershipCancelled(m)) return "cancelled";
  return isMembershipActive(m) ? "active" : "inactive";
}

/** Unified HQ memberships table status (replaces per-route deriveStatus). */
export function resolveHqMembershipDisplayStatus(
  m: HqMembershipStatusInput,
): HqMembershipDisplayStatus {
  if (isMembershipCancelled(m)) return "cancelled";

  if (isMembershipActive(m)) {
    return m.nextScheduledAt ? "scheduled" : "needs scheduling";
  }

  if (!hasPaymentSignal(m)) return "needs card";
  if (m.status === "pending_payment") return "signed";
  return "attention";
}

/**
 * Stripe linkage label for billing/admin surfaces. Unifies the identical
 * function that previously lived in both billing-workspace-server.ts and
 * membership-command-center-server.ts.
 */
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
