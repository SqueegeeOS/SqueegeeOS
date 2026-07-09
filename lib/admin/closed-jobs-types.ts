export const SALE_TYPES = [
  { value: "one_time", label: "One-Time Job" },
  { value: "recurring_membership", label: "Recurring Membership" },
] as const;

export const RECURRING_FREQUENCIES = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "bi_annual", label: "Bi-Annual" },
  { value: "annual", label: "Annual" },
] as const;

export const SERVICE_CATEGORIES = [
  "Window Cleaning",
  "Gutter Cleaning",
  "Pressure Washing",
  "Solar Panel Cleaning",
  "Full Home Care Plan",
  "Other",
] as const;

export type SaleType = (typeof SALE_TYPES)[number]["value"];
export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number]["value"];
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export type RevenuePeriodFilter =
  | "current_month"
  | "last_30_days"
  | "year"
  | "all_time";

export const REVENUE_PERIOD_FILTERS: Array<{
  value: RevenuePeriodFilter;
  label: string;
}> = [
  { value: "current_month", label: "Current Month" },
  { value: "last_30_days", label: "Last 30 Days" },
  { value: "year", label: "Year" },
  { value: "all_time", label: "All Time" },
];

export interface ClosedJob {
  id: string;
  customerName: string;
  propertyAddress: string;
  saleAmount: number;
  saleType: SaleType;
  recurringFrequency: RecurringFrequency | null;
  serviceCategory: ServiceCategory | string;
  closedDate: string;
  notes: string;
  createdAt: string;
  createdBy: string | null;
  status: "closed";
  source: "supabase" | "local" | "mock";
}

export interface ClosedJobInput {
  customerName: string;
  propertyAddress: string;
  saleAmount: number;
  saleType: SaleType;
  recurringFrequency: RecurringFrequency | null;
  serviceCategory: ServiceCategory | string;
  closedDate: string;
  notes: string;
  createdBy?: string | null;
}

export interface MonthlyLedgerEntry {
  monthKey: string;
  monthLabel: string;
  revenueCollected: number;
  arrGenerated: number;
  monthlySalesPerformance: number;
  closedJobsCount: number;
  membershipsSold: number;
  averageTicket: number;
  newCustomers: number;
}

export interface ExecutiveStats {
  revenueCollected: number;
  arrGenerated: number;
  monthlySalesPerformance: number;
  newCustomers: number;
  jobsClosed: number;
  membershipsSold: number;
  averageTicket: number;
  activeMembers: number;
  homeCarePlansCreated: number;
  pendingRequests: number;
  signedAgreements: number;
  closeRatePlaceholder: string;
}

export interface ChartPoint {
  label: string;
  value: number;
}

export interface RevenueChartSeries {
  revenueCollected: ChartPoint[];
  arrGenerated: ChartPoint[];
  monthlySalesPerformance: ChartPoint[];
}

export interface MembershipRevenueOverview {
  active: number;
  pending: number;
  canceled: number;
  estimatedMrr: number;
  popularTier: string;
  source: "supabase" | "mock" | "mixed";
}

import type { WebsiteMembershipSalesOverview } from "./website-membership-sales-types";

export interface AdminDashboardData {
  executive: ExecutiveStats;
  closedJobs: ClosedJob[];
  monthlyLedger: MonthlyLedgerEntry[];
  membership: MembershipRevenueOverview;
  websiteMembershipSales: WebsiteMembershipSalesOverview;
  dataSources: {
    closedJobs: "supabase" | "local" | "mock" | "mixed";
    executive: "supabase" | "local" | "mock" | "mixed";
    membership: "supabase" | "mock" | "mixed";
    websiteMembershipSales: "supabase" | "unavailable";
  };
  storage: "supabase" | "local";
  supabaseConnected: boolean;
  privateBeta: boolean;
}

export interface ClosedJobRow {
  id: string;
  customer_name: string;
  property_address: string;
  sale_amount: number;
  sale_type: SaleType;
  recurring_frequency: RecurringFrequency | null;
  service_category: string;
  closed_date: string;
  notes: string;
  created_by: string | null;
  status: string;
  created_at: string;
}
