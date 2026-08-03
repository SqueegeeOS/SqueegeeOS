import { createHash } from "node:crypto";
import {
  COMPANY_BUSINESS_TIMEZONE,
  formatBusinessCalendarDate,
  zonedDateTimeToUtc,
} from "@/lib/admin/company-business-timezone";

export const AUTOMATIC_BILLING_SETTINGS_ID = "default";
export const MAX_AUTOMATIC_BILLING_ATTEMPTS = 3;
export const AUTOMATIC_BILLING_RETRY_DAYS = 3;

export interface AutomaticBillingMembershipInput {
  id: string;
  status: string;
  agreementId: string | null;
  paymentSetupCompletedAt: string | null;
  stripeCustomerId: string | null;
  stripePaymentMethodId: string | null;
  visitPrice: number | null;
  automaticBillingEnabled: boolean;
  billingAuthorizationIssues: string[];
}

export interface AutomaticBillingAppointmentInput {
  id: string;
  provider: string | null;
  externalId: string | null;
  scheduledAt: string;
  status: string;
  provenanceState: string;
  verificationState: string;
  matchState: string;
  jobberBillingVerified: boolean;
}

export interface AutomaticBillingObligationInput {
  id: string;
  membershipId: string;
  propertyId: string;
  targetWindowStart: string;
  targetWindowEnd: string;
  status: string;
}

export function automaticBillingServiceMonth(
  scheduledAt: string | Date,
): string | null {
  const instant =
    scheduledAt instanceof Date ? scheduledAt : new Date(scheduledAt);
  if (Number.isNaN(instant.getTime())) return null;
  return `${formatBusinessCalendarDate(instant).slice(0, 7)}-01`;
}

function nextMonth(serviceMonth: string): string {
  const [year, month] = serviceMonth.split("-").map(Number);
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
}

export function automaticBillingMonthBounds(
  referenceDate = new Date(),
): { serviceMonth: string; startUtc: Date; endUtc: Date } {
  const serviceMonth = `${formatBusinessCalendarDate(referenceDate).slice(0, 7)}-01`;
  return {
    serviceMonth,
    startUtc: zonedDateTimeToUtc(
      serviceMonth,
      0,
      0,
      0,
      COMPANY_BUSINESS_TIMEZONE,
    ),
    endUtc: zonedDateTimeToUtc(
      nextMonth(serviceMonth),
      0,
      0,
      0,
      COMPANY_BUSINESS_TIMEZONE,
    ),
  };
}

export function automaticBillingBlockingReasons(input: {
  membership: AutomaticBillingMembershipInput;
  appointment: AutomaticBillingAppointmentInput;
  serviceMonth: string;
}): string[] {
  const reasons: string[] = [];
  const membership = input.membership;
  const appointment = input.appointment;

  if (membership.status !== "active") reasons.push("membership_not_active");
  reasons.push(...membership.billingAuthorizationIssues);
  if (!membership.paymentSetupCompletedAt) {
    reasons.push("payment_setup_incomplete");
  }
  if (!membership.stripeCustomerId) reasons.push("stripe_customer_missing");
  if (!membership.stripePaymentMethodId) {
    reasons.push("stripe_payment_method_missing");
  }
  if (
    membership.visitPrice === null ||
    !Number.isFinite(membership.visitPrice) ||
    membership.visitPrice <= 0
  ) {
    reasons.push("authorized_visit_price_missing");
  }
  if (!membership.automaticBillingEnabled) {
    reasons.push("membership_automatic_billing_paused");
  }
  if (appointment.provider?.toLowerCase() !== "jobber") {
    reasons.push("appointment_not_jobber");
  }
  if (!appointment.externalId?.trim()) {
    reasons.push("appointment_external_id_missing");
  }
  if (
    !["provider_imported", "manually_verified"].includes(
      appointment.provenanceState,
    )
  ) {
    reasons.push("appointment_provenance_unverified");
  }
  if (appointment.verificationState !== "verified") {
    reasons.push("appointment_not_verified");
  }
  if (appointment.matchState !== "matched") {
    reasons.push("appointment_not_matched");
  }
  if (!appointment.jobberBillingVerified) {
    reasons.push("jobber_scheduled_service_not_verified");
  }
  if (appointment.status !== "scheduled") {
    reasons.push("appointment_not_scheduled");
  }
  if (automaticBillingServiceMonth(appointment.scheduledAt) !== input.serviceMonth) {
    reasons.push("appointment_service_month_mismatch");
  }
  return reasons;
}

export function automaticBillingOperationKey(
  membershipId: string,
  serviceMonth: string,
  externalVisitId: string,
  scheduledAt: string,
): string {
  const visitRevision = createHash("sha256")
    .update(`${externalVisitId.trim()}|${scheduledAt}`)
    .digest("hex")
    .slice(0, 24);
  return `homeatlas:membership:${encodeURIComponent(
    membershipId.trim(),
  )}:service-month:${serviceMonth}:visit:${visitRevision}:automatic-billing:v2`;
}

export function automaticJobberBillingOperationKey(
  membershipId: string,
  serviceMonth: string,
  billingUnitKey: string,
): string {
  const billingUnitRevision = createHash("sha256")
    .update(billingUnitKey.trim())
    .digest("hex")
    .slice(0, 24);
  return `homeatlas:membership:${encodeURIComponent(
    membershipId.trim(),
  )}:service-month:${serviceMonth}:jobber-unit:${billingUnitRevision}:standing-authorization:v2`;
}

export function findUniqueCoveringObligation(input: {
  obligations: AutomaticBillingObligationInput[];
  membershipId: string;
  propertyId: string;
  scheduledAt: string;
}): AutomaticBillingObligationInput | null {
  const instant = new Date(input.scheduledAt);
  if (Number.isNaN(instant.getTime())) return null;
  const serviceDate = formatBusinessCalendarDate(instant);
  const matches = input.obligations.filter(
    (obligation) =>
      obligation.membershipId === input.membershipId &&
      obligation.propertyId === input.propertyId &&
      !["completed", "credited", "waived", "void"].includes(
        obligation.status,
      ) &&
      obligation.targetWindowStart <= serviceDate &&
      obligation.targetWindowEnd >= serviceDate,
  );
  return matches.length === 1 ? matches[0] : null;
}

export function automaticBillingRetryAt(
  attemptedAt: Date,
  attemptCount: number,
): string | null {
  if (attemptCount >= MAX_AUTOMATIC_BILLING_ATTEMPTS) return null;
  return new Date(
    attemptedAt.getTime() + AUTOMATIC_BILLING_RETRY_DAYS * 24 * 60 * 60 * 1_000,
  ).toISOString();
}

export function canAttemptAutomaticBillingCharge(input: {
  status: string | null;
  attemptCount: number;
  nextRetryAt: string | null;
  now: Date;
  forceRetry?: boolean;
}): boolean {
  if (input.status === "paid" || input.status === "charged") return false;
  if (input.attemptCount >= MAX_AUTOMATIC_BILLING_ATTEMPTS) {
    return input.forceRetry === true;
  }
  if (input.forceRetry) return true;
  if (!input.nextRetryAt) return true;
  const retryAt = new Date(input.nextRetryAt);
  return !Number.isNaN(retryAt.getTime()) && retryAt <= input.now;
}

export function dollarsToBillingCents(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100);
}
