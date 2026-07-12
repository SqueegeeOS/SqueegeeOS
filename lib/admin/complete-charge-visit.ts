import "server-only";

import Stripe from "stripe";
import {
  calculateVisitChargeTotals,
  dollarsToCents,
  validateCompleteChargeVisitInput,
  visitChargeOperationKey,
  type CompleteChargeVisitInput,
  type VisitChargeLineInput,
} from "@/lib/admin/complete-charge-visit-shared";
import { recordMemberAddonService } from "@/lib/admin/record-member-addon-service";
import { canBillMembership } from "@/lib/membership/membership-status";
import { upsertMembershipVisitLedgerEntry } from "@/lib/membership/member-savings-ledger-server";
import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import { createServerSupabaseClient } from "@/lib/persistence/supabase/client";
import { isStripeServerEnabled } from "@/lib/stripe/config";
import { getStripe } from "@/lib/stripe/server";

export type CompleteChargeVisitOutcome =
  | "paid"
  | "already_paid"
  | "declined";

export interface CompleteChargeVisitResult {
  outcome: CompleteChargeVisitOutcome;
  operationKey: string;
  invoiceId: string | null;
  paymentIntentId: string | null;
  amountChargedCents: number;
  savingsRecordedCents: number;
  message: string;
}

interface MembershipRow {
  id: string;
  homeowner_id: string;
  property_id: string;
  status: string;
  payment_setup_completed_at: string | null;
  stripe_customer_id: string | null;
  stripe_payment_method_id: string | null;
}

function serviceMonth(serviceDate: string): string {
  return `${serviceDate.slice(0, 7)}-01`;
}

function lineSavingsCents(line: VisitChargeLineInput): number {
  return Math.max(
    0,
    dollarsToCents(line.retailPrice) - dollarsToCents(line.amountCharged),
  );
}

async function ensureMemberProfileId(homeownerId: string): Promise<string> {
  const supabase = createServerSupabaseClient();
  const { data: existing, error: existingError } = await supabase
    .from("member_profiles")
    .select("id")
    .eq("homeowner_id", homeownerId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing?.id) return existing.id as string;

  const { data: created, error: createError } = await supabase
    .from("member_profiles")
    .insert({ homeowner_id: homeownerId, membership_tier: "standard" })
    .select("id")
    .single();
  if (createError) throw new Error(createError.message);
  return created.id as string;
}

async function recordCompletedServices(input: {
  payload: CompleteChargeVisitInput;
  membership: MembershipRow;
  memberProfileId: string;
}): Promise<number> {
  const supabase = createServerSupabaseClient();
  let savingsRecordedCents = 0;

  for (const line of input.payload.lines) {
    const savedCents = lineSavingsCents(line);
    savingsRecordedCents += savedCents;

    if (line.kind === "membership_visit") {
      const appointmentId = input.payload.appointmentId!;
      const { data: appointment, error: appointmentError } = await supabase
        .from("member_appointments")
        .update({
          status: "completed",
          completed_at: `${input.payload.serviceDate}T12:00:00.000Z`,
        })
        .eq("id", appointmentId)
        .eq("property_id", input.membership.property_id)
        .select("id")
        .maybeSingle();
      if (appointmentError) throw new Error(appointmentError.message);
      if (!appointment) {
        throw new Error("Scheduled appointment not found for this property.");
      }

      await upsertMembershipVisitLedgerEntry({
        membershipId: input.membership.id,
        memberProfileId: input.memberProfileId,
        appointmentId,
        serviceName: line.serviceName.trim(),
        savedCents,
        amountChargedCents: dollarsToCents(line.amountCharged),
        serviceDate: input.payload.serviceDate,
      });
      continue;
    }

    const discountPercent =
      line.retailPrice > 0
        ? Math.round(((line.retailPrice - line.amountCharged) / line.retailPrice) * 100)
        : 0;
    await recordMemberAddonService({
      membershipId: input.membership.id,
      serviceName: line.serviceName,
      serviceDate: input.payload.serviceDate,
      retailPrice: line.retailPrice,
      discountPercent,
      amountCharged: line.amountCharged,
      status: "completed",
      notes: input.payload.internalNote,
    });
  }

  return savingsRecordedCents;
}

function stripeFailureMessage(error: unknown): string {
  if (error instanceof Stripe.errors.StripeCardError) {
    return error.decline_code
      ? `Card declined (${error.decline_code}). Ask the member to approve the charge or update their card.`
      : "Card declined. Ask the member to approve the charge or update their card.";
  }
  return error instanceof Error ? error.message : "Stripe could not process the charge.";
}

export async function completeAndChargeVisit(
  payload: CompleteChargeVisitInput,
): Promise<CompleteChargeVisitResult> {
  const validationError = validateCompleteChargeVisitInput(payload);
  if (validationError) throw new Error(validationError);
  if (!isCloudPersistenceConnected()) {
    throw new Error("Cloud persistence is not connected.");
  }
  if (!isStripeServerEnabled()) {
    throw new Error("Stripe is not configured on the server.");
  }

  const supabase = createServerSupabaseClient();
  const operationKey = visitChargeOperationKey(payload);
  const totals = calculateVisitChargeTotals(payload.lines);
  const period = serviceMonth(payload.serviceDate);

  const { data: membershipData, error: membershipError } = await supabase
    .from("memberships")
    .select(
      "id, homeowner_id, property_id, status, payment_setup_completed_at, stripe_customer_id, stripe_payment_method_id",
    )
    .eq("id", payload.membershipId.trim())
    .maybeSingle();
  if (membershipError) throw new Error(membershipError.message);
  if (!membershipData) throw new Error("Membership not found.");

  const membership = membershipData as MembershipRow;
  if (
    !canBillMembership({
      status: membership.status,
      payment_setup_completed_at: membership.payment_setup_completed_at,
    }) ||
    !membership.stripe_customer_id ||
    !membership.stripe_payment_method_id
  ) {
    throw new Error("An active membership with a saved card is required.");
  }

  const memberProfileId = await ensureMemberProfileId(membership.homeowner_id);
  const savingsRecordedCents = await recordCompletedServices({
    payload,
    membership,
    memberProfileId,
  });

  const { data: existingCharge, error: existingChargeError } = await supabase
    .from("membership_billing_charges")
    .select("id, status, stripe_reference, stripe_payment_intent_id")
    .eq("membership_id", membership.id)
    .eq("service_month", period)
    .maybeSingle();
  if (existingChargeError) throw new Error(existingChargeError.message);

  if (existingCharge?.status === "paid" || existingCharge?.status === "charged") {
    return {
      outcome: "already_paid",
      operationKey,
      invoiceId:
        typeof existingCharge.stripe_reference === "string" &&
        existingCharge.stripe_reference.startsWith("in_")
          ? existingCharge.stripe_reference
          : null,
      paymentIntentId:
        (existingCharge.stripe_payment_intent_id as string | null) ?? null,
      amountChargedCents: totals.chargeTotalCents,
      savingsRecordedCents,
      message: "This visit was already paid. No second charge was created.",
    };
  }

  const pendingRow = {
    membership_id: membership.id,
    homeowner_id: membership.homeowner_id,
    property_id: membership.property_id,
    service_month: period,
    visit_price: totals.chargeTotalCents / 100,
    amount: totals.chargeTotalCents / 100,
    amount_collected: 0,
    status: "pending",
    charged_at: null,
    billing_method: "automatic_stripe",
    notes: payload.internalNote?.trim() || "Complete & Charge Visit",
    created_by: "hq_complete_charge",
  };

  const { error: pendingError } = existingCharge?.id
    ? await supabase
        .from("membership_billing_charges")
        .update(pendingRow)
        .eq("id", existingCharge.id)
    : await supabase.from("membership_billing_charges").insert(pendingRow);
  if (pendingError) throw new Error(pendingError.message);

  const stripe = getStripe();
  let invoiceId =
    typeof existingCharge?.stripe_reference === "string" &&
    existingCharge.stripe_reference.startsWith("in_")
      ? existingCharge.stripe_reference
      : null;

  try {
    let invoice: Stripe.Invoice;
    if (invoiceId) {
      invoice = await stripe.invoices.retrieve(invoiceId);
    } else {
      invoice = await stripe.invoices.create(
        {
          customer: membership.stripe_customer_id,
          collection_method: "charge_automatically",
          auto_advance: false,
          metadata: {
            homeatlas_operation_key: operationKey,
            membership_id: membership.id,
            property_id: membership.property_id,
            appointment_id: payload.appointmentId ?? "",
            service_date: payload.serviceDate,
          },
        },
        { idempotencyKey: `${operationKey}:invoice` },
      );
      invoiceId = invoice.id;

      for (const line of payload.lines) {
        await stripe.invoiceItems.create(
          {
            customer: membership.stripe_customer_id,
            invoice: invoice.id,
            amount: dollarsToCents(line.amountCharged),
            currency: "usd",
            description: line.serviceName.trim(),
            metadata: { kind: line.kind, line_id: line.id },
          },
          { idempotencyKey: `${operationKey}:line:${line.id}` },
        );
      }

      const { error: invoiceSaveError } = await supabase
        .from("membership_billing_charges")
        .update({ stripe_reference: invoice.id })
        .eq("membership_id", membership.id)
        .eq("service_month", period);
      if (invoiceSaveError) throw new Error(invoiceSaveError.message);
    }

    if (invoice.status === "draft") {
      invoice = await stripe.invoices.finalizeInvoice(
        invoice.id,
        { auto_advance: false },
        { idempotencyKey: `${operationKey}:finalize` },
      );
    }
    if (invoice.status !== "paid") {
      invoice = await stripe.invoices.pay(
        invoice.id,
        { payment_method: membership.stripe_payment_method_id },
        { idempotencyKey: `${operationKey}:pay` },
      );
    }

    if (invoice.status !== "paid") {
      throw new Error(`Stripe invoice ended in ${invoice.status ?? "unknown"} status.`);
    }
    const invoicePayments = await stripe.invoicePayments.list({
      invoice: invoice.id,
      status: "paid",
      limit: 1,
    });
    const paymentIntent = invoicePayments.data[0]?.payment.payment_intent;
    const paymentIntentId =
      typeof paymentIntent === "string"
        ? paymentIntent
        : paymentIntent?.id ?? null;

    const { error: paidError } = await supabase
      .from("membership_billing_charges")
      .update({
        status: "paid",
        amount_collected: totals.chargeTotalCents / 100,
        charged_at: new Date().toISOString(),
        stripe_reference: invoice.id,
        stripe_payment_intent_id: paymentIntentId,
      })
      .eq("membership_id", membership.id)
      .eq("service_month", period);
    if (paidError) throw new Error(paidError.message);

    return {
      outcome: "paid",
      operationKey,
      invoiceId: invoice.id,
      paymentIntentId,
      amountChargedCents: totals.chargeTotalCents,
      savingsRecordedCents,
      message: "Visit completed, card charged, and savings recorded.",
    };
  } catch (error) {
    const message = stripeFailureMessage(error);
    await supabase
      .from("membership_billing_charges")
      .update({
        status: "failed",
        amount_collected: 0,
        stripe_reference: invoiceId,
        notes: message,
      })
      .eq("membership_id", membership.id)
      .eq("service_month", period);

    return {
      outcome: "declined",
      operationKey,
      invoiceId,
      paymentIntentId: null,
      amountChargedCents: totals.chargeTotalCents,
      savingsRecordedCents,
      message,
    };
  }
}
