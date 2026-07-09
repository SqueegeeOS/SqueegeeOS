export type BillingLedgerStatus = "paid" | "charged" | "failed" | "pending";

export type BillingMethod = "manual_stripe" | "automatic_stripe";

export interface MembershipBillingChargeRow {
  id: string;
  membership_id: string;
  homeowner_id: string | null;
  property_id: string | null;
  service_month: string;
  visit_price: number | null;
  amount: number;
  amount_collected: number | null;
  status: BillingLedgerStatus;
  charged_at: string | null;
  billing_method: BillingMethod | null;
  stripe_reference: string | null;
  stripe_payment_intent_id: string | null;
  notes: string;
  created_by: string;
  created_at: string;
}

export function isPaidBillingStatus(
  status: BillingLedgerStatus | string,
): boolean {
  return status === "paid" || status === "charged";
}

export function billingPeriodFromChargeDate(chargeDate: string): string {
  const [year, month] = chargeDate.split("-");
  if (!year || !month) return chargeDate;
  return `${year}-${month}-01`;
}

export function chargeTimestampFromDate(chargeDate: string): string {
  return `${chargeDate}T12:00:00.000Z`;
}
