import "server-only";

import { resolveMemberEmail } from "@/lib/agreement/resolve-member-email";
import {
  normalizeEmailDestination,
  type ProviderSendResult,
} from "@/lib/communications/providers/contracts";
import { sendResendEmail } from "@/lib/communications/providers/resend-email";
import { resolvePublicAppOrigin } from "@/lib/membership/portal-access";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { isStripeLiveMode } from "@/lib/stripe/mode";
import { getStripe } from "@/lib/stripe/server";
import { isStripeServerEnabled } from "@/lib/stripe/config";
import { buildHostedMembershipSetupMetadata } from "./hosted-payment-handoff-contract";

const CHECKOUT_TTL_SECONDS = 24 * 60 * 60;
const MAX_CHECKOUT_ATTEMPTS = 25;

interface HostedHandoffRow {
  id: string;
  membership_id: string;
  presentation_id: string;
  agreement_id: string;
  homeowner_id: string;
  property_id: string;
  customer_email: string;
  billing_terms_hash: string;
  status: string;
  checkout_attempt: number;
  stripe_customer_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_url: string | null;
  stripe_payment_url_expires_at: string | null;
  email_provider_message_id: string | null;
}

interface SignedMembershipContext {
  membershipId: string;
  presentationId: string;
  agreementId: string;
  homeownerId: string;
  propertyId: string;
  customerName: string;
  customerEmail: string;
  billingTermsHash: string;
  stripeCustomerId: string | null;
}

export interface HostedPaymentHandoffResult {
  status: "sent" | "already_sent";
  recipientMasked: string;
  expiresAt: string;
  checkoutSessionId: string;
}

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 1)}***@${domain}`;
}

function providerObjectId(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (
    value &&
    typeof value === "object" &&
    "id" in value &&
    typeof value.id === "string"
  ) {
    return value.id;
  }
  return null;
}

function activeSession(row: HostedHandoffRow | null, now = Date.now()): boolean {
  if (!row?.stripe_checkout_session_id || !row.stripe_payment_url) return false;
  const expiresAt = Date.parse(row.stripe_payment_url_expires_at ?? "");
  return Number.isFinite(expiresAt) && expiresAt > now + 60_000;
}

function handoffMatchesContext(
  row: HostedHandoffRow,
  context: SignedMembershipContext,
): boolean {
  return (
    row.membership_id === context.membershipId &&
    row.presentation_id === context.presentationId &&
    row.agreement_id === context.agreementId &&
    row.homeowner_id === context.homeownerId &&
    row.property_id === context.propertyId &&
    row.customer_email === context.customerEmail &&
    row.billing_terms_hash === context.billingTermsHash
  );
}

async function loadSignedMembershipContext(
  membershipId: string,
): Promise<SignedMembershipContext> {
  const supabase = createServiceRoleSupabaseClient();
  const membershipResult = await supabase
    .from("memberships")
    .select(
      "id, homeowner_id, property_id, presentation_id, agreement_id, status, payment_rail, stripe_customer_id, stripe_payment_method_id, payment_setup_completed_at",
    )
    .eq("id", membershipId)
    .maybeSingle();
  if (membershipResult.error) throw new Error(membershipResult.error.message);
  const membership = membershipResult.data;
  if (!membership) throw new Error("Membership not found.");
  if (membership.payment_rail !== "stripe_card") {
    throw new Error(
      "Cash/check accounts cannot receive a Stripe card setup link.",
    );
  }
  if (
    membership.status !== "pending_payment" ||
    membership.payment_setup_completed_at ||
    membership.stripe_payment_method_id
  ) {
    throw new Error("This membership no longer needs a card setup link.");
  }
  if (!membership.presentation_id || !membership.agreement_id) {
    throw new Error("The membership is missing its signed presentation binding.");
  }

  const [homeownerResult, presentationResult, agreementResult] = await Promise.all([
    supabase
      .from("homeowners")
      .select("id, full_name, email")
      .eq("id", membership.homeowner_id)
      .maybeSingle(),
    supabase
      .from("presentations")
      .select(
        "id, homeowner_id, property_id, membership_id, client_name, client_email, status, onboarding_status",
      )
      .eq("id", membership.presentation_id)
      .maybeSingle(),
    supabase
      .from("signed_agreements")
      .select(
        "id, membership_id, homeowner_id, property_id, status, billing_authorization_version, billing_authorized_at, billing_terms_hash",
      )
      .eq("id", membership.agreement_id)
      .maybeSingle(),
  ]);
  if (homeownerResult.error) throw new Error(homeownerResult.error.message);
  if (presentationResult.error) throw new Error(presentationResult.error.message);
  if (agreementResult.error) throw new Error(agreementResult.error.message);
  const homeowner = homeownerResult.data;
  const presentation = presentationResult.data;
  const agreement = agreementResult.data;
  if (!homeowner || !presentation || !agreement) {
    throw new Error("The signed customer record is incomplete.");
  }

  const bindingIssues = [
    presentation.homeowner_id !== membership.homeowner_id
      ? "presentation_homeowner_mismatch"
      : null,
    presentation.property_id !== membership.property_id
      ? "presentation_property_mismatch"
      : null,
    presentation.membership_id !== membership.id
      ? "presentation_membership_mismatch"
      : null,
    agreement.membership_id !== membership.id
      ? "agreement_membership_mismatch"
      : null,
    agreement.homeowner_id !== membership.homeowner_id
      ? "agreement_homeowner_mismatch"
      : null,
    agreement.property_id !== membership.property_id
      ? "agreement_property_mismatch"
      : null,
  ].filter(Boolean);
  if (bindingIssues.length > 0) {
    throw new Error(`Signed customer binding failed: ${bindingIssues.join(", ")}`);
  }
  if (
    presentation.status !== "signed" ||
    agreement.status !== "complete" ||
    !agreement.billing_authorization_version ||
    !agreement.billing_authorized_at ||
    !/^[0-9a-f]{64}$/.test(agreement.billing_terms_hash ?? "")
  ) {
    throw new Error("Completed standing billing authorization is required.");
  }

  const customerEmail = resolveMemberEmail(
    presentation.client_email,
    homeowner.email,
  );
  const normalizedEmail = normalizeEmailDestination(customerEmail);
  if (!normalizedEmail) {
    throw new Error("This customer does not have a valid email address.");
  }
  const customerName =
    presentation.client_name?.trim() || homeowner.full_name?.trim() || "Member";

  return {
    membershipId: membership.id,
    presentationId: presentation.id,
    agreementId: agreement.id,
    homeownerId: homeowner.id,
    propertyId: membership.property_id,
    customerName,
    customerEmail: normalizedEmail,
    billingTermsHash: agreement.billing_terms_hash,
    stripeCustomerId: membership.stripe_customer_id,
  };
}

async function loadOrReserveHandoff(
  context: SignedMembershipContext,
): Promise<HostedHandoffRow> {
  const supabase = createServiceRoleSupabaseClient();
  const existingResult = await supabase
    .from("membership_payment_handoffs")
    .select("*")
    .eq("membership_id", context.membershipId)
    .maybeSingle();
  if (existingResult.error) throw new Error(existingResult.error.message);
  const existing = existingResult.data as HostedHandoffRow | null;
  if (existing?.status === "completed") {
    throw new Error("This membership already completed card setup.");
  }
  if (existing && activeSession(existing) && handoffMatchesContext(existing, context)) {
    return existing;
  }

  const attempt = (existing?.checkout_attempt ?? 0) + 1;
  if (attempt > MAX_CHECKOUT_ATTEMPTS) {
    throw new Error("Card setup retry limit reached. Review this member in HQ.");
  }
  const payload = {
    membership_id: context.membershipId,
    presentation_id: context.presentationId,
    agreement_id: context.agreementId,
    homeowner_id: context.homeownerId,
    property_id: context.propertyId,
    customer_email: context.customerEmail,
    billing_terms_hash: context.billingTermsHash,
    status: "reserved",
    checkout_attempt: attempt,
    stripe_customer_id: context.stripeCustomerId,
    stripe_checkout_session_id: null,
    stripe_setup_intent_id: null,
    stripe_payment_method_id: null,
    stripe_livemode: null,
    stripe_payment_url: null,
    stripe_payment_url_expires_at: null,
    email_provider_message_id: null,
    email_sent_at: null,
    completed_at: null,
    last_error_code: null,
    last_error_message: null,
  };
  const reserved = await supabase
    .from("membership_payment_handoffs")
    .upsert(payload, { onConflict: "membership_id" })
    .select("*")
    .single();
  if (reserved.error) throw new Error(reserved.error.message);
  return reserved.data as HostedHandoffRow;
}

async function ensureStripeCustomer(
  context: SignedMembershipContext,
  handoff: HostedHandoffRow,
): Promise<string> {
  const stripe = getStripe();
  let customerId = context.stripeCustomerId ?? handoff.stripe_customer_id;
  if (customerId) {
    try {
      const customer = await stripe.customers.retrieve(customerId);
      if ("deleted" in customer && customer.deleted) customerId = null;
    } catch {
      customerId = null;
    }
  }
  if (!customerId) {
    const customer = await stripe.customers.create(
      {
        email: context.customerEmail,
        name: context.customerName,
        metadata: {
          membership_id: context.membershipId,
          presentation_id: context.presentationId,
          homeowner_id: context.homeownerId,
          property_id: context.propertyId,
        },
      },
      {
        idempotencyKey: `homeatlas:hosted-setup:${handoff.id}:customer:${handoff.checkout_attempt}`,
      },
    );
    customerId = customer.id;
  } else {
    await stripe.customers.update(customerId, {
      email: context.customerEmail,
      name: context.customerName,
    });
  }

  const supabase = createServiceRoleSupabaseClient();
  const [membershipSave, handoffSave] = await Promise.all([
    supabase
      .from("memberships")
      .update({ stripe_customer_id: customerId })
      .eq("id", context.membershipId),
    supabase
      .from("membership_payment_handoffs")
      .update({ stripe_customer_id: customerId })
      .eq("id", handoff.id),
  ]);
  if (membershipSave.error) throw new Error(membershipSave.error.message);
  if (handoffSave.error) throw new Error(handoffSave.error.message);
  return customerId;
}

async function createOrReuseCheckoutSession(
  context: SignedMembershipContext,
  handoff: HostedHandoffRow,
  requestOrigin?: string | null,
): Promise<{
  id: string;
  url: string;
  expiresAt: string;
  setupIntentId: string | null;
}> {
  if (activeSession(handoff)) {
    return {
      id: handoff.stripe_checkout_session_id!,
      url: handoff.stripe_payment_url!,
      expiresAt: handoff.stripe_payment_url_expires_at!,
      setupIntentId: null,
    };
  }
  const customerId = await ensureStripeCustomer(context, handoff);
  const binding = {
    handoffId: handoff.id,
    membershipId: context.membershipId,
    presentationId: context.presentationId,
    agreementId: context.agreementId,
    homeownerId: context.homeownerId,
    propertyId: context.propertyId,
    billingTermsHash: context.billingTermsHash,
  };
  const metadata = buildHostedMembershipSetupMetadata(binding);
  const origin = resolvePublicAppOrigin(requestOrigin);
  const expiresAtSeconds = Math.floor(Date.now() / 1000) + CHECKOUT_TTL_SECONDS;
  const session = await getStripe().checkout.sessions.create(
    {
      mode: "setup",
      customer: customerId,
      client_reference_id: handoff.id,
      payment_method_types: ["card"],
      metadata,
      setup_intent_data: {
        metadata,
      },
      custom_text: {
        submit: {
          message:
            "No charge is collected during this step. Future charges follow the service agreement you already signed.",
        },
      },
      success_url: `${origin}/payment/setup/complete`,
      cancel_url: `${origin}/payment/setup/cancelled`,
      expires_at: expiresAtSeconds,
    },
    {
      idempotencyKey: `homeatlas:hosted-setup:${handoff.id}:checkout:${handoff.checkout_attempt}`,
    },
  );
  if (!session.url) throw new Error("Stripe did not return a hosted setup URL.");
  const expiresAt = new Date(expiresAtSeconds * 1000).toISOString();
  const setupIntentId = providerObjectId(session.setup_intent);
  const save = await createServiceRoleSupabaseClient()
    .from("membership_payment_handoffs")
    .update({
      status: "session_ready",
      stripe_customer_id: customerId,
      stripe_checkout_session_id: session.id,
      stripe_setup_intent_id: setupIntentId,
      stripe_livemode: isStripeLiveMode(),
      stripe_payment_url: session.url,
      stripe_payment_url_expires_at: expiresAt,
      last_error_code: null,
      last_error_message: null,
    })
    .eq("id", handoff.id);
  if (save.error) throw new Error(save.error.message);
  return { id: session.id, url: session.url, expiresAt, setupIntentId };
}

async function recordEmailDelivery(input: {
  context: SignedMembershipContext;
  handoff: HostedHandoffRow;
  session: { id: string; expiresAt: string };
  result: ProviderSendResult;
  actor: "homeatlas_hq" | `sales_rep:${string}`;
}): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const idempotencyKey = `membership-payment-setup-${input.handoff.id}-${input.session.id}`;
  const now = new Date().toISOString();
  const communication = await supabase.from("membership_communications").upsert(
    {
      membership_id: input.context.membershipId,
      communication_type: "payment_setup_email",
      channel: "email",
      provider: "resend",
      provider_message_id: input.result.ok
        ? input.result.providerMessageId
        : null,
      idempotency_key: idempotencyKey,
      destination_masked: maskEmail(input.context.customerEmail),
      status: input.result.ok ? "accepted" : "failed",
      reason: input.result.ok ? null : input.result.errorCode,
      sent_at: input.result.ok ? now : null,
    },
    { onConflict: "idempotency_key" },
  );
  if (communication.error) throw new Error(communication.error.message);

  const handoffUpdate = await supabase
    .from("membership_payment_handoffs")
    .update({
      status: input.result.ok ? "email_sent" : "needs_attention",
      email_provider_message_id: input.result.ok
        ? input.result.providerMessageId
        : null,
      email_sent_at: input.result.ok ? now : null,
      last_error_code: input.result.ok ? null : "payment_setup_email_failed",
      last_error_message: input.result.ok
        ? null
        : `Resend did not accept the payment setup email (${input.result.errorCode}).`,
    })
    .eq("id", input.handoff.id);
  if (handoffUpdate.error) throw new Error(handoffUpdate.error.message);

  const event = await supabase.from("membership_payment_handoff_events").insert({
    handoff_id: input.handoff.id,
    event_type: input.result.ok ? "payment_setup_email_accepted" : "payment_setup_email_failed",
    actor: input.actor,
    provider: "resend",
    provider_event_key: input.result.ok
      ? `payment-setup-email:${input.handoff.id}:${input.session.id}`
      : null,
    event_data: {
      checkoutSessionId: input.session.id,
      expiresAt: input.session.expiresAt,
      emailStatus: input.result.status,
    },
  });
  if (event.error && event.error.code !== "23505") {
    throw new Error(event.error.message);
  }
}

export async function sendHostedMembershipPaymentLink(input: {
  membershipId: string;
  requestOrigin?: string | null;
  actor?: "homeatlas_hq" | `sales_rep:${string}`;
}): Promise<HostedPaymentHandoffResult> {
  if (!isStripeServerEnabled()) {
    throw new Error("Stripe is not configured for hosted card setup.");
  }
  const context = await loadSignedMembershipContext(input.membershipId);
  const handoff = await loadOrReserveHandoff(context);
  if (
    handoff.status === "email_sent" &&
    handoff.email_provider_message_id &&
    activeSession(handoff)
  ) {
    return {
      status: "already_sent",
      recipientMasked: maskEmail(context.customerEmail),
      expiresAt: handoff.stripe_payment_url_expires_at!,
      checkoutSessionId: handoff.stripe_checkout_session_id!,
    };
  }
  const session = await createOrReuseCheckoutSession(
    context,
    handoff,
    input.requestOrigin,
  );
  const safeName = htmlEscape(context.customerName);
  const emailName = context.customerName.replace(/[\r\n]+/g, " ").trim().slice(0, 120);
  const safeUrl = htmlEscape(session.url);
  const replyTo =
    process.env.RESEND_COMMUNICATIONS_REPLY_TO?.trim() ||
    process.env.HOMEATLAS_LEGAL_NOTICE_EMAIL?.trim() ||
    "hello@squeegeeking.net";
  const email = await sendResendEmail({
    to: context.customerEmail,
    replyTo,
    idempotencyKey: `membership-payment-setup-${handoff.id}-${session.id}`,
    subject: `${emailName}, securely add your card for SqueegeeKing`,
    text:
      `Hi ${emailName},\n\nYour service agreement is complete. Save your card on Stripe's secure page: ${session.url}\n\n` +
      "No charge is collected during this setup step. Future charges follow the service agreement you already signed. SqueegeeKing never sees or stores your card number.\n\n" +
      "Questions? Reply to this email and we will help.",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px 20px;color:#17211c">
        <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#587060">HomeAtlas · SqueegeeKing</p>
        <h1 style="font-family:Georgia,serif;font-size:32px;font-weight:400;margin:14px 0">Your agreement is complete. One secure step remains.</h1>
        <p style="font-size:16px;line-height:1.65">Hi ${safeName} — use Stripe's hosted page to save your card for your SqueegeeKing membership.</p>
        <p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;background:#183f2b;color:#fff;text-decoration:none;padding:15px 22px;border-radius:10px;font-weight:700">Open secure Stripe setup</a></p>
        <p style="font-size:14px;line-height:1.6;color:#587060"><strong>No charge is collected during this setup step.</strong> Future charges follow the service agreement you already signed. SqueegeeKing never sees or stores your card number.</p>
        <p style="font-size:14px;line-height:1.6;color:#587060">Questions? Reply to this email and we will help.</p>
      </div>`,
  });
  await recordEmailDelivery({
    context,
    handoff,
    session,
    result: email,
    actor: input.actor ?? "homeatlas_hq",
  });
  if (!email.ok) {
    throw new Error("The Stripe link is ready, but the email provider did not accept the message.");
  }
  return {
    status: "sent",
    recipientMasked: maskEmail(context.customerEmail),
    expiresAt: session.expiresAt,
    checkoutSessionId: session.id,
  };
}
