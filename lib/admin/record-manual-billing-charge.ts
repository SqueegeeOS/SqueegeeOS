import {
  chargeDateForServiceWindow,
  resolveCurrentBillingPeriod,
} from "@/lib/admin/billing-charge-dates";
import {
  billingPeriodFromChargeDate,
  chargeTimestampFromDate,
  isPaidBillingStatus,
} from "@/lib/admin/billing-ledger";
import {
  createServerSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";

export interface RecordManualBillingChargeInput {
  membershipId: string;
  amount: number;
  chargeDate: string;
  stripeReference?: string;
  notes?: string;
}

export interface RecordManualBillingChargeResult {
  chargeId: string;
  billingPeriod: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateRecordManualBillingChargeInput(
  input: RecordManualBillingChargeInput,
): string | null {
  if (!input.membershipId?.trim()) {
    return "Membership is required.";
  }
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    return "Charge amount must be zero or greater.";
  }
  if (!input.chargeDate?.trim() || !ISO_DATE_RE.test(input.chargeDate)) {
    return "Charge date must be YYYY-MM-DD.";
  }
  const parsed = new Date(`${input.chargeDate}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return "Charge date is invalid.";
  }
  return null;
}

export async function recordManualBillingCharge(
  input: RecordManualBillingChargeInput,
): Promise<RecordManualBillingChargeResult> {
  const validationError = validateRecordManualBillingChargeInput(input);
  if (validationError) {
    throw new Error(validationError);
  }

  if (!isSupabaseConfigured()) {
    throw new Error("Billing ledger requires Supabase.");
  }

  const supabase = createServerSupabaseClient();

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("id, homeowner_id, property_id, visit_price, status")
    .eq("id", input.membershipId)
    .maybeSingle();

  if (membershipError) {
    throw new Error(membershipError.message);
  }
  if (!membership) {
    throw new Error("Membership not found.");
  }
  if (membership.status !== "active") {
    throw new Error("Only active memberships can be charged.");
  }

  const { data: obligations, error: obligationsError } = await supabase
    .from("obligations")
    .select("target_window_start, status")
    .eq("membership_id", membership.id)
    .order("target_window_start", { ascending: true });

  if (obligationsError) {
    throw new Error(obligationsError.message);
  }

  const { data: existingCharges, error: chargesError } = await supabase
    .from("membership_billing_charges")
    .select("service_month, status")
    .eq("membership_id", membership.id);

  if (chargesError) {
    throw new Error(chargesError.message);
  }

  const paidServiceMonths = (existingCharges ?? [])
    .filter((row) => isPaidBillingStatus(row.status))
    .map((row) => row.service_month as string);

  const obligationInputs = (obligations ?? []).map((row) => ({
    targetWindowStart: row.target_window_start as string,
    status: row.status as string,
  }));

  const billingPeriod =
    resolveCurrentBillingPeriod(obligationInputs, paidServiceMonths) ??
    billingPeriodFromChargeDate(input.chargeDate);

  const serviceMonth = chargeDateForServiceWindow(billingPeriod);

  const duplicate = (existingCharges ?? []).find(
    (row) =>
      (row.service_month as string).startsWith(serviceMonth.slice(0, 7)) &&
      isPaidBillingStatus(row.status as string),
  );
  if (duplicate) {
    throw new Error(
      "This billing period already has a recorded charge. Duplicate recording is not allowed.",
    );
  }

  const visitPrice =
    membership.visit_price != null ? Number(membership.visit_price) : null;
  const stripeReference = input.stripeReference?.trim() || null;
  const notes = input.notes?.trim() ?? "";

  const { data: inserted, error: insertError } = await supabase
    .from("membership_billing_charges")
    .insert({
      membership_id: membership.id,
      homeowner_id: membership.homeowner_id,
      property_id: membership.property_id,
      service_month: serviceMonth,
      visit_price: visitPrice,
      amount: input.amount,
      amount_collected: input.amount,
      status: "paid",
      charged_at: chargeTimestampFromDate(input.chargeDate),
      billing_method: "manual_stripe",
      stripe_reference: stripeReference,
      stripe_payment_intent_id: stripeReference,
      notes,
      created_by: "hq",
    })
    .select("id, service_month")
    .single();

  if (insertError) {
    if (insertError.message.includes("unique")) {
      throw new Error(
        "This billing period already has a recorded charge. Duplicate recording is not allowed.",
      );
    }
    throw new Error(insertError.message);
  }

  return {
    chargeId: inserted.id as string,
    billingPeriod: inserted.service_month as string,
  };
}
