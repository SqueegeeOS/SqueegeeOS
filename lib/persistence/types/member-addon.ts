export type MemberAddonStatus = "quoted" | "scheduled" | "completed" | "paid";

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
  notes: string | null;
  created_at: string;
  updated_at: string;
}
