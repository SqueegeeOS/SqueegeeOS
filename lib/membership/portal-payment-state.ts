import {
  hasPaymentMethodOnFile,
  isMembershipActive,
  isMembershipCancelled,
  resolveMembershipLifecycle,
} from "@/lib/membership/membership-status";

export const PAYMENT_METHOD_ON_FILE_LABEL = "Payment method on file ✓";

export interface PortalPaymentStateInput {
  membershipStatus: string;
  paymentSetupCompletedAt: string | null;
  paymentMethodLabel: string | null;
  hasMembership: boolean;
  paymentRail?: "stripe_card" | "manual_cash_check";
  manualPaymentApprovedAt?: string | null;
  manualPaymentApprovedBy?: string | null;
}

export interface PortalPaymentState {
  paymentOnFile: boolean;
  pendingPayment: boolean;
  membershipActive: boolean;
  headline: string;
  support: string;
  detailLine: string;
  showUpdatePaymentMethod: boolean;
}

export function resolvePortalPaymentState(
  input: PortalPaymentStateInput,
): PortalPaymentState {
  const cardOnFile = hasPaymentMethodOnFile({
    status: input.membershipStatus,
    payment_setup_completed_at: input.paymentSetupCompletedAt,
  });
  const manualPaymentReady = Boolean(
    input.paymentRail === "manual_cash_check" &&
      input.manualPaymentApprovedAt?.trim() &&
      input.manualPaymentApprovedBy?.trim(),
  );
  const paymentOnFile = cardOnFile || manualPaymentReady;
  const membershipActive = isMembershipActive({
    status: input.membershipStatus,
    payment_setup_completed_at: input.paymentSetupCompletedAt,
    payment_rail: input.paymentRail,
    manual_payment_approved_at: input.manualPaymentApprovedAt,
    manual_payment_approved_by: input.manualPaymentApprovedBy,
  });
  const lifecycle = resolveMembershipLifecycle({
    status: input.membershipStatus,
    payment_setup_completed_at: input.paymentSetupCompletedAt,
    payment_rail: input.paymentRail,
    manual_payment_approved_at: input.manualPaymentApprovedAt,
    manual_payment_approved_by: input.manualPaymentApprovedBy,
  });
  const pendingPayment =
    input.hasMembership &&
    !paymentOnFile &&
    !isMembershipCancelled({ status: input.membershipStatus }) &&
    (lifecycle.state === "payment_pending" ||
      lifecycle.state === "activation_pending" ||
      lifecycle.state === "agreement_pending" ||
      (lifecycle.state === "inconsistent" && !lifecycle.isActive));

  const headline = manualPaymentReady
    ? "Cash or check account"
    : paymentOnFile
    ? (input.paymentMethodLabel ?? PAYMENT_METHOD_ON_FILE_LABEL)
    : "Add payment method";

  const support = manualPaymentReady
    ? "Pay by cash or check after each completed service."
    : paymentOnFile
    ? "Billed on the 1st of your service month."
    : "Add your payment method to complete your membership.";

  const detailLine = manualPaymentReady
    ? "No card is stored and automatic card billing is disabled."
    : paymentOnFile
    ? "Your payment method is secured on file."
    : "Finish payment setup to activate billing.";

  return {
    paymentOnFile,
    pendingPayment,
    membershipActive,
    headline,
    support,
    detailLine,
    showUpdatePaymentMethod:
      cardOnFile && input.hasMembership && !manualPaymentReady,
  };
}
