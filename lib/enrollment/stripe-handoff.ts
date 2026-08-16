import "server-only";

import { sendResendEmail } from "@/lib/communications/providers/resend-email";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { resolvePublicAppOrigin } from "@/lib/membership/portal-access";
import { getStripe } from "@/lib/stripe/server";
import { isStripeServerEnabled } from "@/lib/stripe/config";
import { enrollmentTokenSha256, generateEnrollmentToken } from "./token";
import type { EnrollmentPacketRow } from "./types";

const CHECKOUT_TTL_SECONDS = 24 * 60 * 60;

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function checkoutSessionId(value: unknown): string | null {
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

export async function createEnrollmentStripeHandoff(input: {
  packet: EnrollmentPacketRow;
  membershipId: string;
  requestOrigin?: string | null;
}): Promise<{
  checkoutSessionId: string;
  paymentUrl: string;
  enrollmentUrl: string;
  emailSent: boolean;
  reused: boolean;
}> {
  if (!isStripeServerEnabled()) {
    throw new Error("Stripe is not configured for the enrollment handoff.");
  }
  const supabase = createServiceRoleSupabaseClient();
  const membershipResult = await supabase
    .from("memberships")
    .select(
      "id, homeowner_id, property_id, presentation_id, stripe_customer_id, status",
    )
    .eq("id", input.membershipId)
    .maybeSingle();
  if (membershipResult.error) throw new Error(membershipResult.error.message);
  if (!membershipResult.data) throw new Error("Enrollment membership not found.");
  const membership = membershipResult.data;
  if (membership.presentation_id !== input.packet.presentation_id) {
    throw new Error("Enrollment packet and membership presentation do not match.");
  }

  const stripe = getStripe();
  let customerId = membership.stripe_customer_id as string | null;
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
        email: input.packet.customer_email,
        name: input.packet.customer_name,
        metadata: {
          membership_id: input.membershipId,
          presentation_id: input.packet.presentation_id,
          homeowner_id: membership.homeowner_id as string,
          property_id: membership.property_id as string,
        },
      },
      { idempotencyKey: `homeatlas:enrollment:${input.packet.id}:customer` },
    );
    customerId = customer.id;
    const customerSave = await supabase
      .from("memberships")
      .update({ stripe_customer_id: customerId })
      .eq("id", input.membershipId);
    if (customerSave.error) throw new Error(customerSave.error.message);
  } else {
    await stripe.customers.update(customerId, {
      email: input.packet.customer_email,
      name: input.packet.customer_name,
    });
  }

  const rawToken = generateEnrollmentToken();
  const attempt = Math.max(0, input.packet.stripe_checkout_attempt ?? 0) + 1;
  if (attempt > 25) {
    throw new Error("Enrollment payment-link retry limit reached.");
  }
  const origin = resolvePublicAppOrigin(input.requestOrigin);
  const enrollmentUrl = `${origin}/enroll/${encodeURIComponent(rawToken)}`;
  const expiresAtSeconds = Math.floor(Date.now() / 1000) + CHECKOUT_TTL_SECONDS;
  const metadata = {
    homeatlas_operation: "membership_enrollment_setup",
    homeatlas_enrollment_packet_id: input.packet.id,
    membership_id: input.membershipId,
    presentation_id: input.packet.presentation_id,
  };
  const session = await stripe.checkout.sessions.create(
    {
      mode: "setup",
      currency: "usd",
      customer: customerId,
      client_reference_id: input.packet.id,
      payment_method_types: ["card"],
      metadata,
      setup_intent_data: { metadata },
      success_url: `${enrollmentUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${enrollmentUrl}?payment=cancelled`,
      expires_at: expiresAtSeconds,
    },
    {
      idempotencyKey: `homeatlas:enrollment:${input.packet.id}:setup-checkout:${attempt}`,
    },
  );
  if (!session.url) throw new Error("Stripe did not return a hosted setup URL.");
  const setupIntentId = checkoutSessionId(session.setup_intent);
  const expiresAt = new Date(expiresAtSeconds * 1000).toISOString();
  const saveHandoff = await supabase
    .from("enrollment_packets")
    .update({
      status: "payment_ready",
      public_token_sha256: enrollmentTokenSha256(rawToken),
      public_token_expires_at: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      stripe_checkout_session_id: session.id,
      stripe_setup_intent_id: setupIntentId,
      stripe_payment_url: session.url,
      stripe_payment_url_expires_at: expiresAt,
      stripe_checkout_attempt: attempt,
      last_error_code: null,
      last_error_message: null,
    })
    .eq("id", input.packet.id);
  if (saveHandoff.error) throw new Error(saveHandoff.error.message);

  const replyTo =
    process.env.RESEND_COMMUNICATIONS_REPLY_TO?.trim() ||
    process.env.HOMEATLAS_LEGAL_NOTICE_EMAIL?.trim() ||
    "hello@squeegeeking.net";
  const safeName = htmlEscape(input.packet.customer_name);
  const safeStripeUrl = htmlEscape(session.url);
  const safeEnrollmentUrl = htmlEscape(enrollmentUrl);
  const email = await sendResendEmail({
    to: input.packet.customer_email,
    replyTo,
    idempotencyKey: `enrollment-payment-${input.packet.id}-${session.id}`,
    subject: `${input.packet.customer_name}, one secure step for your HomeAtlas membership`,
    text:
      `Your agreement is complete. Add your payment method on Stripe's secure page: ${session.url}\n\n` +
      `Then open your HomeAtlas handoff: ${enrollmentUrl}\n\nNo payment is collected today.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px 20px;color:#17211c">
        <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#587060">HomeAtlas · SqueegeeKing</p>
        <h1 style="font-family:Georgia,serif;font-size:32px;font-weight:400;margin:14px 0">Agreement complete. One secure step left.</h1>
        <p style="font-size:16px;line-height:1.65">Hi ${safeName} — DocuSign is complete. Use Stripe's hosted page to save your payment method, then your private home portal turns on automatically.</p>
        <p style="margin:28px 0"><a href="${safeStripeUrl}" style="display:inline-block;background:#183f2b;color:#fff;text-decoration:none;padding:15px 22px;border-radius:10px;font-weight:700">Open secure Stripe setup</a></p>
        <p style="font-size:14px;line-height:1.6;color:#587060">No payment is collected today. SqueegeeKing never sees or stores your card number.</p>
        <p style="font-size:14px;line-height:1.6;color:#587060">Want to check progress? <a href="${safeEnrollmentUrl}" style="color:#183f2b">Open your HomeAtlas handoff</a>.</p>
      </div>`,
  });
  const emailSent = email.ok;
  const markDelivery = await supabase
    .from("enrollment_packets")
    .update({
      status: emailSent ? "payment_sent" : "payment_ready",
      payment_link_sent_at: emailSent ? new Date().toISOString() : null,
      last_error_code: emailSent ? null : "payment_email_failed",
      last_error_message: emailSent
        ? null
        : `Resend could not accept the payment-link email (${email.errorCode}).`,
    })
    .eq("id", input.packet.id);
  if (markDelivery.error) throw new Error(markDelivery.error.message);
  const eventResult = await supabase.from("enrollment_packet_events").insert({
    enrollment_packet_id: input.packet.id,
    event_type: emailSent ? "payment_link_sent" : "payment_link_ready",
    actor: "homeatlas_server",
    provider: emailSent ? "resend" : null,
    provider_event_key: emailSent
      ? `payment-email:${input.packet.id}:${session.id}`
      : null,
    event_data: {
      checkoutSessionId: session.id,
      expiresAt,
      emailStatus: email.status,
    },
  });
  if (eventResult.error && eventResult.error.code !== "23505") {
    throw new Error(eventResult.error.message);
  }
  if (!emailSent) {
    throw new Error(
      "The Stripe link is ready, but the separate customer email was not accepted. HomeAtlas will retry safely.",
    );
  }
  return {
    checkoutSessionId: session.id,
    paymentUrl: session.url,
    enrollmentUrl,
    emailSent,
    reused: false,
  };
}
