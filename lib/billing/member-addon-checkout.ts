import "server-only";

import type Stripe from "stripe";
import {
  recordMemberAddonService,
  type RecordMemberAddonInput,
} from "@/lib/admin/record-member-addon-service";
import { upsertAddonLedgerEntry } from "@/lib/membership/member-savings-ledger-server";
import { resolvePublicAppOrigin } from "@/lib/membership/portal-access";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { isStripeServerEnabled } from "@/lib/stripe/config";
import { isStripeLiveMode } from "@/lib/stripe/mode";
import { getStripe } from "@/lib/stripe/server";

const CHECKOUT_TTL_SECONDS = 23 * 60 * 60;

interface AddonCheckoutRow {
  id: string;
  membership_id: string;
  member_profile_id: string | null;
  property_id: string;
  service_name: string;
  service_date: string;
  amount_charged_cents: number;
  saved_cents: number;
  status: string;
  payment_status: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  payment_url: string | null;
  payment_url_expires_at: string | null;
  checkout_attempt: number;
}

interface AddonCheckoutMembershipRow {
  id: string;
  homeowner_id: string;
  property_id: string;
  status: string;
  stripe_customer_id: string | null;
}

export interface CreateMemberAddonCheckoutResult {
  addonId: string;
  paymentUrl: string;
  expiresAt: string;
  reused: boolean;
}

function stripeObjectId(
  value: string | { id: string } | null | undefined,
): string | null {
  return typeof value === "string" ? value : value?.id ?? null;
}

function checkoutMetadata(input: {
  addonId: string;
  membershipId: string;
  propertyId: string;
}): Record<string, string> {
  return {
    homeatlas_operation: "member_addon_checkout",
    homeatlas_addon_id: input.addonId,
    membership_id: input.membershipId,
    property_id: input.propertyId,
  };
}

function paymentUrlStillOpen(row: AddonCheckoutRow, now: Date): boolean {
  if (
    row.payment_status !== "checkout_open" ||
    !row.payment_url ||
    !row.payment_url_expires_at
  ) {
    return false;
  }
  return new Date(row.payment_url_expires_at).getTime() > now.getTime() + 60_000;
}

export function memberAddonPaymentIntentBindingIssues(input: {
  intent: Pick<
    Stripe.PaymentIntent,
    "amount" | "currency" | "customer" | "livemode" | "metadata"
  >;
  addon: Pick<AddonCheckoutRow, "id" | "amount_charged_cents">;
  membership: Pick<
    AddonCheckoutMembershipRow,
    "id" | "property_id" | "stripe_customer_id"
  >;
  stripeLiveMode: boolean;
}): string[] {
  const issues: string[] = [];
  if (input.intent.metadata.homeatlas_operation !== "member_addon_checkout") {
    issues.push("operation_mismatch");
  }
  if (input.intent.metadata.homeatlas_addon_id !== input.addon.id) {
    issues.push("addon_mismatch");
  }
  if (input.intent.metadata.membership_id !== input.membership.id) {
    issues.push("membership_mismatch");
  }
  if (input.intent.metadata.property_id !== input.membership.property_id) {
    issues.push("property_mismatch");
  }
  if (input.intent.currency.toLowerCase() !== "usd") {
    issues.push("currency_mismatch");
  }
  if (input.intent.livemode !== input.stripeLiveMode) {
    issues.push("stripe_mode_mismatch");
  }
  if (
    input.membership.stripe_customer_id &&
    stripeObjectId(input.intent.customer) !== input.membership.stripe_customer_id
  ) {
    issues.push("stripe_customer_mismatch");
  }
  if (input.intent.amount !== input.addon.amount_charged_cents) {
    issues.push("amount_mismatch");
  }
  return issues;
}

async function loadCheckoutContext(addonId: string): Promise<{
  addon: AddonCheckoutRow;
  membership: AddonCheckoutMembershipRow;
  customerEmail: string | null;
}> {
  const supabase = createServiceRoleSupabaseClient();
  const addonResult = await supabase
    .from("member_addon_transactions")
    .select(
      "id, membership_id, member_profile_id, property_id, service_name, service_date, amount_charged_cents, saved_cents, status, payment_status, stripe_checkout_session_id, stripe_payment_intent_id, payment_url, payment_url_expires_at, checkout_attempt",
    )
    .eq("id", addonId)
    .maybeSingle();
  if (addonResult.error) throw new Error(addonResult.error.message);
  if (!addonResult.data) throw new Error("Add-on service not found.");
  const addon = addonResult.data as AddonCheckoutRow;

  const membershipResult = await supabase
    .from("memberships")
    .select("id, homeowner_id, property_id, status, stripe_customer_id")
    .eq("id", addon.membership_id)
    .maybeSingle();
  if (membershipResult.error) throw new Error(membershipResult.error.message);
  if (!membershipResult.data) throw new Error("Membership not found.");
  const membership = membershipResult.data as AddonCheckoutMembershipRow;
  if (membership.property_id !== addon.property_id) {
    throw new Error("Add-on service is not bound to the membership property.");
  }
  if (membership.status === "cancelled") {
    throw new Error("Cancelled memberships cannot receive payment links.");
  }

  const homeownerResult = await supabase
    .from("homeowners")
    .select("email")
    .eq("id", membership.homeowner_id)
    .maybeSingle();
  if (homeownerResult.error) throw new Error(homeownerResult.error.message);

  return {
    addon,
    membership,
    customerEmail:
      typeof homeownerResult.data?.email === "string"
        ? homeownerResult.data.email
        : null,
  };
}

export async function createMemberAddonCheckout(input: {
  addon: Omit<RecordMemberAddonInput, "status">;
  requestOrigin?: string | null;
}): Promise<CreateMemberAddonCheckoutResult> {
  if (!isStripeServerEnabled()) {
    throw new Error("Stripe is not configured on the server.");
  }
  if (!Number.isFinite(input.addon.amountCharged) || input.addon.amountCharged <= 0) {
    throw new Error("A payment link requires an amount greater than zero.");
  }

  const recorded = await recordMemberAddonService({
    ...input.addon,
    status: "quoted",
  });
  const context = await loadCheckoutContext(recorded.addonId);
  const { addon, membership } = context;
  if (addon.status === "paid" || addon.payment_status === "paid") {
    throw new Error("This add-on is already paid.");
  }

  const now = new Date();
  if (paymentUrlStillOpen(addon, now)) {
    return {
      addonId: addon.id,
      paymentUrl: addon.payment_url!,
      expiresAt: addon.payment_url_expires_at!,
      reused: true,
    };
  }

  const stripe = getStripe();
  const attempt = Math.max(0, addon.checkout_attempt) + 1;
  if (attempt > 25) throw new Error("Payment-link attempt limit reached.");
  const expiresAtSeconds = Math.floor(now.getTime() / 1000) + CHECKOUT_TTL_SECONDS;
  const origin = resolvePublicAppOrigin(input.requestOrigin);
  const metadata = checkoutMetadata({
    addonId: addon.id,
    membershipId: membership.id,
    propertyId: membership.property_id,
  });

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      ...(membership.stripe_customer_id
        ? { customer: membership.stripe_customer_id }
        : context.customerEmail
          ? { customer_email: context.customerEmail }
          : {}),
      client_reference_id: addon.id,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: addon.amount_charged_cents,
            product_data: {
              name: addon.service_name.slice(0, 120),
              description: `SqueegeeKing service scheduled for ${addon.service_date}`,
            },
          },
        },
      ],
      metadata,
      payment_intent_data: {
        description: addon.service_name.slice(0, 500),
        metadata,
      },
      success_url: `${origin}/payment/complete?status=success`,
      cancel_url: `${origin}/payment/complete?status=cancelled`,
      expires_at: expiresAtSeconds,
    },
    { idempotencyKey: `homeatlas:addon:${addon.id}:checkout:${attempt}` },
  );
  if (!session.url) {
    throw new Error("Stripe did not return a customer payment URL.");
  }

  const expiresAt = new Date(expiresAtSeconds * 1000).toISOString();
  const supabase = createServiceRoleSupabaseClient();
  const update = await supabase
    .from("member_addon_transactions")
    .update({
      payment_status: "checkout_open",
      stripe_checkout_session_id: session.id,
      payment_url: session.url,
      payment_url_expires_at: expiresAt,
      checkout_attempt: attempt,
      updated_at: now.toISOString(),
    })
    .eq("id", addon.id)
    .eq("amount_charged_cents", addon.amount_charged_cents);
  if (update.error) throw new Error(update.error.message);

  return {
    addonId: addon.id,
    paymentUrl: session.url,
    expiresAt,
    reused: false,
  };
}

export async function reconcileMemberAddonPaymentIntent(input: {
  eventType: string;
  intent: Stripe.PaymentIntent;
}): Promise<"paid" | "failed" | "ignored"> {
  const addonId = input.intent.metadata.homeatlas_addon_id?.trim();
  if (
    input.intent.metadata.homeatlas_operation !== "member_addon_checkout" ||
    !addonId
  ) {
    return "ignored";
  }

  const context = await loadCheckoutContext(addonId);
  const { addon, membership } = context;
  const issues = memberAddonPaymentIntentBindingIssues({
    intent: input.intent,
    addon,
    membership,
    stripeLiveMode: isStripeLiveMode(),
  });
  if (issues.length > 0) {
    throw new Error(`Add-on payment binding failed: ${issues.join(", ")}`);
  }

  const supabase = createServiceRoleSupabaseClient();
  if (input.eventType === "payment_intent.succeeded") {
    if (
      input.intent.status !== "succeeded" ||
      input.intent.amount_received !== addon.amount_charged_cents
    ) {
      throw new Error("Stripe add-on success did not contain the full payment.");
    }
    if (
      addon.payment_status === "paid" &&
      addon.stripe_payment_intent_id !== input.intent.id
    ) {
      throw new Error("Add-on is already bound to another Stripe payment.");
    }
    const approvedAt = new Date(input.intent.created * 1000).toISOString();
    const update = await supabase
      .from("member_addon_transactions")
      .update({
        status: "paid",
        payment_status: "paid",
        stripe_payment_intent_id: input.intent.id,
        customer_approved_at: approvedAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", addon.id)
      .eq("amount_charged_cents", addon.amount_charged_cents);
    if (update.error) throw new Error(update.error.message);

    if (addon.member_profile_id && addon.saved_cents > 0) {
      await upsertAddonLedgerEntry({
        membershipId: membership.id,
        memberProfileId: addon.member_profile_id,
        addonId: addon.id,
        serviceName: addon.service_name,
        savedCents: addon.saved_cents,
        amountChargedCents: addon.amount_charged_cents,
        serviceDate: addon.service_date,
      });
    }
    return "paid";
  }

  if (
    input.eventType === "payment_intent.payment_failed" ||
    input.eventType === "payment_intent.requires_action"
  ) {
    if (addon.payment_status !== "paid") {
      const update = await supabase
        .from("member_addon_transactions")
        .update({
          payment_status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", addon.id);
      if (update.error) throw new Error(update.error.message);
    }
    return "failed";
  }

  return "ignored";
}
