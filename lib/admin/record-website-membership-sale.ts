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
  membershipId: string;
  paymentSetupCompletedAt: string;
  soldAt?: string;
  activationMode: WebsiteMembershipSaleActivationMode;
}

export interface RecordWebsiteMembershipSaleResult {
  recorded: boolean;
  saleId?: string;
  skippedReason?: string;
}

interface MembershipSaleContextRow {
  id: string;
  homeowner_id: string;
  property_id: string;
  presentation_id: string | null;
  agreement_id: string | null;
  sales_tier: string | null;
  visit_price: number | null;
  visits_per_year: number | null;
  payment_setup_completed_at: string | null;
  stripe_payment_method_id: string | null;
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

  const { data: membership, error } = await supabase
    .from("memberships")
    .select(
      "id, homeowner_id, property_id, presentation_id, agreement_id, sales_tier, visit_price, visits_per_year, payment_setup_completed_at, stripe_payment_method_id",
    )
    .eq("id", input.membershipId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!membership) {
    return { recorded: false, skippedReason: "membership_not_found" };
  }

  const row = membership as MembershipSaleContextRow;

  if (!row.presentation_id) {
    return { recorded: false, skippedReason: "missing_presentation" };
  }

  if (!row.agreement_id) {
    return { recorded: false, skippedReason: "missing_agreement" };
  }

  if (!isWebsiteMembershipSaleTier(row.sales_tier)) {
    return { recorded: false, skippedReason: "invalid_tier" };
  }

  if (row.visit_price == null || row.visits_per_year == null) {
    return { recorded: false, skippedReason: "missing_pricing" };
  }

  const paymentSetupCompletedAt =
    input.paymentSetupCompletedAt ||
    row.payment_setup_completed_at ||
    input.soldAt;

  if (!paymentSetupCompletedAt) {
    return { recorded: false, skippedReason: "missing_payment_setup" };
  }

  if (
    input.activationMode === "stripe" &&
    !row.stripe_payment_method_id
  ) {
    return { recorded: false, skippedReason: "missing_stripe_payment_method" };
  }

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
      row.presentation_id
        ? supabase
            .from("presentations")
            .select("client_email, client_name")
            .eq("id", row.presentation_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
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

  const soldAt = input.soldAt ?? paymentSetupCompletedAt;
  const annualizedValue = computeAnnualizedMembershipValue(
    row.visit_price,
    row.visits_per_year,
  );

  const { data: inserted, error: insertError } = await supabase
    .from("website_membership_sales")
    .insert({
      membership_id: row.id,
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
        .eq("membership_id", row.id)
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
