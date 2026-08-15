export type MemberAddonStatus = "quoted" | "scheduled" | "completed" | "paid";
export type MemberAddonPaymentStatus =
  | "record_only"
  | "checkout_open"
  | "paid"
  | "failed"
  | "expired";

export const MEMBER_ADDON_REVENUE_STATUSES: MemberAddonStatus[] = [
  "completed",
  "paid",
];

export interface PersistedMemberAddonTransaction {
  id: string;
  membership_id: string;
  member_profile_id: string | null;
  property_id: string;
  service_name: string;
  service_date: string;
  retail_price_cents: number;
  discount_percent: number;
  amount_charged_cents: number;
  saved_cents: number;
  sales_tier: string | null;
  status: MemberAddonStatus;
  payment_status: MemberAddonPaymentStatus;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  payment_url: string | null;
  payment_url_expires_at: string | null;
  customer_approved_at: string | null;
  checkout_attempt: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
