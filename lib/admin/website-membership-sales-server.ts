import {
  createServerSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";
import { getBusinessCalendarDayUtcBounds } from "./company-business-timezone";
import type {
  WebsiteMembershipSale,
  WebsiteMembershipSaleRow,
  WebsiteMembershipSalesOverview,
} from "./website-membership-sales-types";

const EMPTY_OVERVIEW: WebsiteMembershipSalesOverview = {
  todayCount: 0,
  monthCount: 0,
  todayAnnualizedValue: 0,
  monthAnnualizedValue: 0,
  totalAnnualizedValue: 0,
  recentSales: [],
  source: "unavailable",
};

function mapSaleRow(row: WebsiteMembershipSaleRow): WebsiteMembershipSale {
  return {
    id: row.id,
    membershipId: row.membership_id,
    homeownerId: row.homeowner_id,
    propertyId: row.property_id,
    presentationId: row.presentation_id,
    agreementId: row.agreement_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    propertyAddress: row.property_address,
    tier: row.sales_tier,
    visitPrice: Number(row.visit_price),
    visitsPerYear: row.visits_per_year,
    annualizedValue: Number(row.annualized_value),
    paymentSetupCompletedAt: row.payment_setup_completed_at,
    soldAt: row.sold_at,
    source: row.source,
  };
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function isSoldOnBusinessToday(soldAt: string, reference: Date): boolean {
  const soldInstant = new Date(soldAt);
  const { startUtc, endUtc } = getBusinessCalendarDayUtcBounds(reference);
  return soldInstant >= startUtc && soldInstant < endUtc;
}

export async function loadWebsiteMembershipSalesOverview(): Promise<WebsiteMembershipSalesOverview> {
  if (!isSupabaseConfigured()) {
    return EMPTY_OVERVIEW;
  }

  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("website_membership_sales")
      .select("*")
      .order("sold_at", { ascending: false })
      .limit(50);

    if (error) {
      if (
        error.message.includes("website_membership_sales") &&
        error.message.includes("does not exist")
      ) {
        return EMPTY_OVERVIEW;
      }
      throw error;
    }

    const rows = (data ?? []) as WebsiteMembershipSaleRow[];
    const now = new Date();
    const monthStart = startOfUtcMonth(now).toISOString();

    const todaySales = rows.filter((row) => isSoldOnBusinessToday(row.sold_at, now));
    const monthSales = rows.filter((row) => row.sold_at >= monthStart);

    return {
      todayCount: todaySales.length,
      monthCount: monthSales.length,
      todayAnnualizedValue: todaySales.reduce(
        (sum, row) => sum + Number(row.annualized_value),
        0,
      ),
      monthAnnualizedValue: monthSales.reduce(
        (sum, row) => sum + Number(row.annualized_value),
        0,
      ),
      totalAnnualizedValue: rows.reduce(
        (sum, row) => sum + Number(row.annualized_value),
        0,
      ),
      recentSales: rows.slice(0, 20).map(mapSaleRow),
      source: "supabase",
    };
  } catch (error) {
    console.error("[website-membership-sales] overview load failed:", error);
    return EMPTY_OVERVIEW;
  }
}
