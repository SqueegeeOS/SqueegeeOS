import {
  hasPaymentMethodOnFile,
  isMembershipActive,
} from "@/lib/membership/membership-status";

export const PAYMENT_METHOD_ON_FILE_LABEL = "Payment method on file ✓";

export interface PortalPaymentStateInput {
  membershipStatus: string;
  paymentSetupCompletedAt: string | null;
  paymentMethodLabel: string | null;
  hasMembership: boolean;
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
  const paymentOnFile = hasPaymentMethodOnFile({
    status: input.membershipStatus,
    payment_setup_completed_at: input.paymentSetupCompletedAt,
  });
  const membershipActive = isMembershipActive({
    status: input.membershipStatus,
    payment_setup_completed_at: input.paymentSetupCompletedAt,
  });
  const pendingPayment =
    !paymentOnFile &&
    input.hasMembership &&
    input.membershipStatus !== "cancelled" &&
    (input.membershipStatus === "pending_payment" ||
      input.membershipStatus === "active" ||
      input.membershipStatus === "inactive");

  const headline = paymentOnFile
    ? (input.paymentMethodLabel ?? PAYMENT_METHOD_ON_FILE_LABEL)
    : "Add payment method";

  const support = paymentOnFile
    ? "Billed on the 1st of your service month."
    : "Add your payment method to complete your membership.";

  const detailLine = paymentOnFile
    ? "Your payment method is secured on file."
    : "Finish payment setup to activate billing.";

  return {
    paymentOnFile,
    pendingPayment,
    membershipActive,
    headline,
    support,
    detailLine,
    showUpdatePaymentMethod: paymentOnFile && input.hasMembership,
  };
}
