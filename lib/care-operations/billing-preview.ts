import type { AppointmentProvenance } from "./model";
import { isAuthoritativeProviderAppointment } from "./model";
import { formatBusinessCalendarDate } from "@/lib/admin/company-business-timezone";

export const BILLING_EXECUTION_ENABLED = false as const;

export interface BillingPreviewInput {
  obligationId: string;
  appointmentId: string;
  appointment: AppointmentProvenance;
  pricingSnapshotId: string | null;
  authorizedChargeCents: number | null;
  creditAppliedCents: number;
  stripeCustomerReady: boolean;
  stripePaymentMethodReady: boolean;
  serviceMonth: string;
  scheduledServiceAt: string;
}

export interface BillingPreview {
  billable: boolean;
  executionEnabled: false;
  expectedChargeCents: number;
  blockingReasons: string[];
}

export function serviceMonthForVisit(scheduledServiceAt: string): string | null {
  const instant = new Date(scheduledServiceAt);
  if (Number.isNaN(instant.getTime())) return null;
  return `${formatBusinessCalendarDate(instant).slice(0, 7)}-01`;
}

export function buildBillingPreview(input: BillingPreviewInput): BillingPreview {
  const blockingReasons: string[] = [];
  if (!isAuthoritativeProviderAppointment(input.appointment)) {
    blockingReasons.push("appointment_not_verified_provider_truth");
  }
  if (!input.pricingSnapshotId || input.authorizedChargeCents === null) {
    blockingReasons.push("immutable_pricing_snapshot_required");
  }
  if (!input.stripeCustomerReady) blockingReasons.push("stripe_customer_not_ready");
  if (!input.stripePaymentMethodReady) {
    blockingReasons.push("stripe_payment_method_not_ready");
  }
  if (input.creditAppliedCents < 0) blockingReasons.push("invalid_credit");
  const amount = Math.max(0, input.authorizedChargeCents ?? 0);
  if (input.creditAppliedCents > amount) blockingReasons.push("credit_exceeds_amount");
  const visitServiceMonth = serviceMonthForVisit(input.scheduledServiceAt);
  if (!visitServiceMonth) {
    blockingReasons.push("invalid_scheduled_service_at");
  } else if (visitServiceMonth !== input.serviceMonth) {
    blockingReasons.push("service_month_visit_mismatch");
  }

  return {
    billable: blockingReasons.length === 0,
    executionEnabled: BILLING_EXECUTION_ENABLED,
    expectedChargeCents: Math.max(0, amount - input.creditAppliedCents),
    blockingReasons,
  };
}

export function assertBillingExecutionDisabled(): void {
  throw new Error("Billing execution is disabled in the preview-only release.");
}
