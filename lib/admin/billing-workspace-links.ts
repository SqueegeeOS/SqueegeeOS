import { jobberTodayVisitAnchorId } from "@/lib/care-operations/jobber-today-links";
import { ROUTES } from "@/lib/navigation/config";

const SAFE_FRAGMENT_CHARACTER = /[^a-zA-Z0-9_-]/g;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const BILLING_PAYMENT_REVIEW_ANCHOR = "billing-payment-review";

export interface BillingWorkspaceFocus {
  membershipId: string;
  appointmentId: string;
  returnTo: string;
}

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function safeTodayReturnPath(value: string | string[] | undefined): string {
  const candidate = first(value);
  if (!candidate || candidate.length > 500) return ROUTES.hqToday;
  if (!candidate.startsWith(`${ROUTES.hqToday}#`)) return ROUTES.hqToday;
  const fragment = candidate.slice(`${ROUTES.hqToday}#`.length);
  return /^[a-zA-Z0-9_-]{1,200}$/.test(fragment)
    ? candidate
    : ROUTES.hqToday;
}

export function billingMembershipAnchorId(membershipId: string): string {
  const normalized = membershipId
    .trim()
    .replace(SAFE_FRAGMENT_CHARACTER, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
  return `billing-${normalized || "unknown"}`;
}

export function resolveBillingWorkspaceFocus(input: {
  membership?: string | string[];
  appointment?: string | string[];
  returnTo?: string | string[];
}): BillingWorkspaceFocus | null {
  const membershipId = first(input.membership);
  const appointmentId = first(input.appointment);
  if (!UUID_PATTERN.test(membershipId) || !UUID_PATTERN.test(appointmentId)) {
    return null;
  }
  return {
    membershipId,
    appointmentId,
    returnTo: safeTodayReturnPath(input.returnTo),
  };
}

export function billingTodayReviewHref(input: {
  membershipId: string;
  appointmentId: string;
  projectionId: string;
}): string {
  const returnTo = `${ROUTES.hqToday}#${jobberTodayVisitAnchorId(input.projectionId)}`;
  const params = new URLSearchParams({
    membership: input.membershipId,
    appointment: input.appointmentId,
    returnTo,
  });
  return `${ROUTES.hqBilling}?${params.toString()}#${BILLING_PAYMENT_REVIEW_ANCHOR}`;
}
