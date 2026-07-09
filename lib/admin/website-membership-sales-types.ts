export const WEBSITE_MEMBERSHIP_SALE_SOURCE = "website_presentation" as const;

export type WebsiteMembershipSaleTier = "biannual" | "quarterly";

export type WebsiteMembershipSaleActivationMode = "stripe" | "mock";

export interface WebsiteMembershipSale {
  id: string;
  membershipId: string;
  homeownerId: string;
  propertyId: string;
  presentationId: string | null;
  agreementId: string | null;
  customerName: string;
  customerEmail: string | null;
  propertyAddress: string;
  tier: WebsiteMembershipSaleTier;
  visitPrice: number;
  visitsPerYear: number;
  annualizedValue: number;
  paymentSetupCompletedAt: string;
  soldAt: string;
  source: typeof WEBSITE_MEMBERSHIP_SALE_SOURCE;
}

export interface WebsiteMembershipSalesOverview {
  todayCount: number;
  monthCount: number;
  todayAnnualizedValue: number;
  monthAnnualizedValue: number;
  totalAnnualizedValue: number;
  recentSales: WebsiteMembershipSale[];
  source: "supabase" | "unavailable";
}

export interface WebsiteMembershipSaleRow {
  id: string;
  membership_id: string;
  homeowner_id: string;
  property_id: string;
  presentation_id: string | null;
  agreement_id: string | null;
  customer_name: string;
  customer_email: string | null;
  property_address: string;
  sales_tier: WebsiteMembershipSaleTier;
  visit_price: number;
  visits_per_year: number;
  annualized_value: number;
  payment_setup_completed_at: string;
  sold_at: string;
  source: typeof WEBSITE_MEMBERSHIP_SALE_SOURCE;
  created_at: string;
}
