export const MANUAL_PAYMENT_BILLING_PAUSE_REASON =
  "Cash/check agreement; automatic card billing is disabled";

export function enrollmentMembershipBillingState(input: {
  manualPayment: boolean;
  pausedAt: string;
}) {
  return input.manualPayment
    ? {
        payment_setup_completed_at: input.pausedAt,
        automatic_billing_enabled: false,
        automatic_billing_paused_at: input.pausedAt,
        automatic_billing_pause_reason: MANUAL_PAYMENT_BILLING_PAUSE_REASON,
      }
    : {
        payment_setup_completed_at: null,
        automatic_billing_enabled: true,
        automatic_billing_paused_at: null,
        automatic_billing_pause_reason: null,
      };
}
