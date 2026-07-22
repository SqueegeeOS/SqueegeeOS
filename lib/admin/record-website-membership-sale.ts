import { resolveMemberEmail } from "@/lib/agreement/resolve-member-email";
import {
  computeAnnualizedMembershipValue,
  formatPropertyAddress,
  isWebsiteMembershipSaleTier,
  qualifiesForWebsiteMembershipSale,
} from "@/lib/admin/website-membership-sales";
import {
  WEBSITE_MEMBERSHIP_SALE_SOURCE,
  type WebsiteMembershipSaleActivationMode,
} from "@/lib/admin/website-membership-sales-types";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface RecordWebsiteMembershipSaleInput {
  activation: {
    membership_id: string;
    presentation_id: string;
    agreement_id: string;
    homeowner_id: string;
    property_id: string;
    sales_tier: "biannual" | "quarterly";
    visit_price: number;
    visits_per_year: number;
    payment_setup_completed_at: string;
  };
  activationMode: WebsiteMembershipSaleActivationMode;
}

export interface RecordWebsiteMembershipSaleResult {
  recorded: boolean;
  saleId?: string;
  skippedReason?: string;
}

export async function recordWebsiteMembershipSale(
  supabase: SupabaseClient,
  input: RecordWebsiteMembershipSaleInput,
): Promise<RecordWebsiteMembershipSaleResult> {
  if (!qualifiesForWebsiteMembershipSale(input.activationMode)) {
    return {
      recorded: false,
      skippedReason: "mock_activation_not_counted",
    };
  }

  const row = input.activation;

  if (!isWebsiteMembershipSaleTier(row.sales_tier)) {
    return { recorded: false, skippedReason: "invalid_tier" };
  }

  if (row.visit_price == null || row.visits_per_year == null) {
    return { recorded: false, skippedReason: "missing_pricing" };
  }

  const paymentSetupCompletedAt = row.payment_setup_completed_at;

  const [{ data: homeowner }, { data: property }, { data: presentation }] =
    await Promise.all([
      supabase
        .from("homeowners")
        .select("full_name, email")
        .eq("id", row.homeowner_id)
        .maybeSingle(),
      supabase
        .from("properties")
        .select("address, city, state, zip")
        .eq("id", row.property_id)
        .maybeSingle(),
      supabase
        .from("presentations")
        .select("client_email, client_name")
        .eq("id", row.presentation_id)
        .maybeSingle(),
    ]);

  if (!homeowner || !property) {
    return { recorded: false, skippedReason: "missing_customer_context" };
  }

  const customerEmail = resolveMemberEmail(
    presentation?.client_email as string | null | undefined,
    homeowner.email as string | null | undefined,
  );
  const customerName =
    (presentation?.client_name as string | null | undefined)?.trim() ||
    (homeowner.full_name as string | null | undefined)?.trim() ||
    "Member";

  const soldAt = paymentSetupCompletedAt;
  const annualizedValue = computeAnnualizedMembershipValue(
    row.visit_price,
    row.visits_per_year,
  );

  const { data: inserted, error: insertError } = await supabase
    .from("website_membership_sales")
    .insert({
      membership_id: row.membership_id,
      homeowner_id: row.homeowner_id,
      property_id: row.property_id,
      presentation_id: row.presentation_id,
      agreement_id: row.agreement_id,
      customer_name: customerName,
      customer_email: customerEmail,
      property_address: formatPropertyAddress({
        address: property.address as string,
        city: property.city as string,
        state: property.state as string,
        zip: property.zip as string,
      }),
      sales_tier: row.sales_tier,
      visit_price: row.visit_price,
      visits_per_year: row.visits_per_year,
      annualized_value: annualizedValue,
      payment_setup_completed_at: paymentSetupCompletedAt,
      sold_at: soldAt,
      source: WEBSITE_MEMBERSHIP_SALE_SOURCE,
    })
    .select("id")
    .maybeSingle();

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: existing } = await supabase
        .from("website_membership_sales")
        .select("id")
        .eq("membership_id", row.membership_id)
        .maybeSingle();

      return {
        recorded: false,
        saleId: existing?.id as string | undefined,
        skippedReason: "already_recorded",
      };
    }

    if (
      insertError.message.includes("website_membership_sales") &&
      insertError.message.includes("does not exist")
    ) {
      console.warn(
        "[website-membership-sales] table missing — run migration 022",
      );
      return { recorded: false, skippedReason: "table_missing" };
    }

    throw new Error(insertError.message);
  }

  return {
    recorded: true,
    saleId: inserted?.id as string | undefined,
  };
}
