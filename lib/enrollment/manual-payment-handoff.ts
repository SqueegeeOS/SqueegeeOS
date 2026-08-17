import "server-only";

import { sendResendEmail } from "@/lib/communications/providers/resend-email";
import {
  buildPortalAccessUrl,
} from "@/lib/membership/portal-access";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import type { EnrollmentPacketRow } from "./types";

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function completeManualPaymentHandoff(input: {
  packet: EnrollmentPacketRow;
  membershipId: string;
}): Promise<{ portalUrl: string; emailSent: boolean }> {
  if (input.packet.payment_rail !== "manual_cash_check") {
    throw new Error("Only a manual cash/check packet can use this handoff.");
  }
  if (
    !input.packet.manual_payment_approved_at ||
    !input.packet.manual_payment_approved_by
  ) {
    throw new Error("The cash/check account is missing owner approval evidence.");
  }

  const supabase = createServiceRoleSupabaseClient();
  const membershipResult = await supabase
    .from("memberships")
    .select(
      "id, presentation_id, payment_rail, manual_payment_approved_at, manual_payment_approved_by, portal_access_token, status, automatic_billing_enabled",
    )
    .eq("id", input.membershipId)
    .maybeSingle();
  if (membershipResult.error) throw new Error(membershipResult.error.message);
  const membership = membershipResult.data;
  if (!membership?.portal_access_token) {
    throw new Error("The cash/check membership is missing its private portal token.");
  }
  if (
    membership.presentation_id !== input.packet.presentation_id ||
    membership.payment_rail !== "manual_cash_check" ||
    !membership.manual_payment_approved_at ||
    !membership.manual_payment_approved_by ||
    membership.automatic_billing_enabled
  ) {
    throw new Error("The cash/check membership failed its no-automatic-charge boundary.");
  }

  const portalUrl = buildPortalAccessUrl(membership.portal_access_token as string);
  const safeName = htmlEscape(input.packet.customer_name);
  const safePortalUrl = htmlEscape(portalUrl);
  const replyTo =
    process.env.RESEND_COMMUNICATIONS_REPLY_TO?.trim() ||
    process.env.HOMEATLAS_LEGAL_NOTICE_EMAIL?.trim() ||
    "hello@squeegeeking.net";
  const email = await sendResendEmail({
    to: input.packet.customer_email,
    replyTo,
    idempotencyKey: `enrollment-manual-portal-${input.packet.id}`,
    subject: `${input.packet.customer_name}, your HomeAtlas is ready`,
    text:
      `Your agreement is complete and your cash/check payment arrangement is on file. Open your private HomeAtlas portal: ${portalUrl}\n\n` +
      "No card was stored and automatic card billing is not enabled.",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px 20px;color:#17211c">
        <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#587060">HomeAtlas · SqueegeeKing</p>
        <h1 style="font-family:Georgia,serif;font-size:32px;font-weight:400;margin:14px 0">Your home is under care.</h1>
        <p style="font-size:16px;line-height:1.65">Hi ${safeName} — your agreement and cash/check payment arrangement are complete. Your private home-care portal is ready.</p>
        <p style="margin:28px 0"><a href="${safePortalUrl}" style="display:inline-block;background:#183f2b;color:#fff;text-decoration:none;padding:15px 22px;border-radius:10px;font-weight:700">Open my HomeAtlas</a></p>
        <p style="font-size:14px;line-height:1.6;color:#587060">No card was stored and automatic card billing is not enabled for this account.</p>
      </div>`,
  });
  const completedAt = new Date().toISOString();
  const markReady = await supabase
    .from("enrollment_packets")
    .update({
      status: "portal_ready",
      portal_ready_at: completedAt,
      last_error_code: email.ok ? null : "manual_portal_email_failed",
      last_error_message: email.ok
        ? null
        : `The portal is ready, but Resend did not accept the email (${email.errorCode}).`,
    })
    .eq("id", input.packet.id);
  if (markReady.error) throw new Error(markReady.error.message);

  const eventResult = await supabase.from("enrollment_packet_events").insert({
    enrollment_packet_id: input.packet.id,
    event_type: email.ok
      ? "manual_payment_portal_sent"
      : "manual_payment_portal_ready",
    actor: "homeatlas_server",
    provider: email.ok ? "resend" : null,
    provider_event_key: email.ok
      ? `manual-portal-email:${input.packet.id}`
      : null,
    event_data: {
      paymentRail: "manual_cash_check",
      ownerApprovedAt: input.packet.manual_payment_approved_at,
      ownerApprovedBy: input.packet.manual_payment_approved_by,
      emailStatus: email.status,
      portalReadyAt: completedAt,
    },
  });
  if (eventResult.error && eventResult.error.code !== "23505") {
    throw new Error(eventResult.error.message);
  }
  return { portalUrl, emailSent: email.ok };
}
