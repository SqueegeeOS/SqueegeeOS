export const PAYMENT_RAILS = ["stripe_card", "manual_cash_check"] as const;

export type PaymentRail = (typeof PAYMENT_RAILS)[number];

export const DEFAULT_PAYMENT_RAIL: PaymentRail = "stripe_card";

export function isPaymentRail(value: unknown): value is PaymentRail {
  return value === "stripe_card" || value === "manual_cash_check";
}

export function normalizePaymentRail(
  value: unknown,
  fallback: PaymentRail = DEFAULT_PAYMENT_RAIL,
): PaymentRail {
  return isPaymentRail(value) ? value : fallback;
}

export function paymentRailLabel(value: PaymentRail): string {
  return value === "manual_cash_check"
    ? "Cash or check account"
    : "Secure card on Stripe";
}

export function isManualPaymentRail(value: PaymentRail): boolean {
  return value === "manual_cash_check";
}
