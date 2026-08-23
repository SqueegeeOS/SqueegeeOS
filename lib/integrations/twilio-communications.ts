import "server-only";

import { createHash } from "node:crypto";
import type { CustomerMessageDeliveryStatus } from "@/lib/communications/types";
import {
  normalizeProviderDeliveryStatus,
  type ProviderDeliveryStatus,
} from "@/lib/communications/providers/contracts";
import type {
  SmsConsentKeyword,
  TwilioInboundMessage,
} from "@/lib/communications/providers/twilio-webhooks";
import {
  ensureHomeownerConversation,
  ensureLeadConversation,
  normalizeCustomerPhone,
  recordInboundCommunication,
  resolveTwilioInboundContact,
  updateCommunicationDelivery,
} from "@/lib/communications/repository";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";

export function normalizeStoredUsPhoneToE164(
  value: string | null | undefined,
): string | null {
  return normalizeCustomerPhone(value);
}

export function customerMessageStatusForTwilio(
  value: string | null | undefined,
): CustomerMessageDeliveryStatus | null {
  const status: ProviderDeliveryStatus = normalizeProviderDeliveryStatus(value);
  switch (status) {
    case "accepted":
    case "queued":
    case "sending":
    case "sent":
    case "delivered":
    case "read":
    case "received":
    case "failed":
      return status;
    case "undelivered":
      return "failed";
    case "canceled":
      return "cancelled";
    default:
      return null;
  }
}

export function resolveTwilioSignatureUrl(request: Request): string {
  const parsed = new URL(request.url);
  const protocol =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    parsed.protocol.replace(":", "");
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host") ||
    parsed.host;
  return `${protocol}://${host}${parsed.pathname}${parsed.search}`;
}

function hashPayload(rawPayload: string): string {
  return createHash("sha256").update(rawPayload, "utf8").digest("hex");
}

function maskedPhone(phone: string): string {
  return `***${phone.slice(-4)}`;
}

export function existingContactPointUpdateForInboundSms(
  keyword: SmsConsentKeyword,
  verifiedAt: string,
): {
  verification_status: "verified";
  verified_at: string;
  consent_status?: "opted_out" | "opted_in";
  consent_source?: "twilio_keyword";
  consent_recorded_at?: string;
  opt_out_reason?: "customer_keyword" | null;
} {
  const verification = {
    verification_status: "verified" as const,
    verified_at: verifiedAt,
  };
  if (keyword === "none") return verification;

  const consentStatus = keyword === "stop" ? "opted_out" : "opted_in";
  return {
    ...verification,
    consent_status: consentStatus,
    consent_source: "twilio_keyword",
    consent_recorded_at: verifiedAt,
    opt_out_reason:
      consentStatus === "opted_out" ? "customer_keyword" : null,
  };
}

async function ensureInboundContactPoint(input: {
  homeownerId: string;
  phone: string;
  existingId: string | null;
  keyword: SmsConsentKeyword;
}): Promise<string | null> {
  const supabase = createServiceRoleSupabaseClient();
  const now = new Date().toISOString();
  const consentStatus =
    input.keyword === "stop"
      ? "opted_out"
      : input.keyword === "start"
        ? "opted_in"
        : "unknown";
  const consentRecordedAt = consentStatus === "unknown" ? null : now;
  if (input.existingId) {
    const updated = await supabase
      .from("customer_contact_points")
      .update(existingContactPointUpdateForInboundSms(input.keyword, now))
      .eq("id", input.existingId)
      .eq("channel", "sms")
      .eq("address_normalized", input.phone)
      .select("id")
      .maybeSingle();
    if (updated.error || updated.data?.id !== input.existingId) {
      throw new Error("contact_consent_update_failed");
    }
    return input.existingId;
  }

  const inserted = await supabase
    .from("customer_contact_points")
    .upsert(
      {
        homeowner_id: input.homeownerId,
        channel: "sms",
        address_normalized: input.phone,
        address_masked: maskedPhone(input.phone),
        is_primary: false,
        verification_status: "verified",
        verified_at: now,
        consent_status: consentStatus,
        consent_source:
          input.keyword === "none" ? "customer_inbound" : "twilio_keyword",
        consent_recorded_at: consentRecordedAt,
        opt_out_reason:
          consentStatus === "opted_out" ? "customer_keyword" : null,
      },
      { onConflict: "channel,address_normalized" },
    )
    .select("id")
    .maybeSingle();
  if (inserted.error || !inserted.data?.id) {
    throw new Error("contact_point_upsert_failed");
  }
  return inserted.data.id as string;
}

export async function recordTwilioInboundMessage(input: {
  message: TwilioInboundMessage;
  rawPayload: string;
}): Promise<{ matched: boolean; duplicate: boolean }> {
  const supabase = createServiceRoleSupabaseClient();
  const hash = hashPayload(input.rawPayload);
  const event = await supabase
    .from("customer_communication_webhook_events")
    .insert({
      provider: "twilio",
      provider_event_id: input.message.messageSid,
      event_type: "message.inbound",
      provider_message_id: input.message.messageSid,
      payload_hash: hash,
      processing_status: "received",
    });
  const duplicate = event.error?.code === "23505";
  if (event.error && !duplicate) throw new Error("webhook_event_create_failed");

  const resolution = await resolveTwilioInboundContact(input.message.from);
  if (resolution.status !== "resolved") {
    const ignored = await supabase
      .from("customer_communication_webhook_events")
      .update({
        processing_status: "ignored",
        error_code: `${resolution.status}_sender`,
        processed_at: new Date().toISOString(),
      })
      .eq("provider", "twilio")
      .eq("provider_event_id", input.message.messageSid);
    if (ignored.error) throw new Error("webhook_event_ignore_failed");
    return { matched: false, duplicate };
  }

  let contactPointId = resolution.contactPointId;
  if (resolution.homeownerId) {
    contactPointId = await ensureInboundContactPoint({
      homeownerId: resolution.homeownerId,
      phone: resolution.normalizedPhone ?? input.message.from,
      existingId: resolution.contactPointId,
      keyword: input.message.consentKeyword,
    });
  } else if (
    resolution.leadIntakeId &&
    input.message.consentKeyword !== "none"
  ) {
    const leadConsent = await supabase
      .from("lead_intakes")
      .update({
        sms_consent_status:
          input.message.consentKeyword === "stop" ? "opted_out" : "opted_in",
        sms_consent_recorded_at: new Date().toISOString(),
      })
      .eq("id", resolution.leadIntakeId);
    if (leadConsent.error) throw new Error("lead_consent_update_failed");
  }

  const conversationId =
    resolution.conversationId ??
    (resolution.homeownerId
      ? (
          await ensureHomeownerConversation({
            homeownerId: resolution.homeownerId,
            subject: "Customer text conversation",
          })
        ).id
      : (
          await ensureLeadConversation({
            leadIntakeId: resolution.leadIntakeId!,
            subject: "Website request text conversation",
          })
        ).id);
  const inbound = await recordInboundCommunication({
    conversationId,
    contactPointId,
    channel: "sms",
    provider: "twilio",
    providerMessageId: input.message.messageSid,
    senderAddress: input.message.from,
    recipientAddress: input.message.to,
    body: input.message.body,
  });
  const now = new Date().toISOString();
  const processed = await supabase
    .from("customer_communication_webhook_events")
    .update({
      customer_message_id: inbound.message.id,
      processing_status: "processed",
      processed_at: now,
      error_code: null,
    })
    .eq("provider", "twilio")
    .eq("provider_event_id", input.message.messageSid);
  if (processed.error) throw new Error("webhook_event_finalize_failed");
  return { matched: true, duplicate: duplicate || inbound.duplicate };
}

export async function recordTwilioStatusCallback(input: {
  messageSid: string;
  messageStatus: string;
  errorCode?: string | null;
  rawPayload: string;
}): Promise<void> {
  const nextStatus = customerMessageStatusForTwilio(input.messageStatus);
  if (!nextStatus) return;
  const supabase = createServiceRoleSupabaseClient();
  const hash = hashPayload(input.rawPayload);
  const occurredAt = new Date().toISOString();
  const updated = await updateCommunicationDelivery({
    provider: "twilio",
    providerMessageId: input.messageSid,
    deliveryStatus: nextStatus,
    occurredAt,
    failureCode: input.errorCode?.trim() || null,
  });
  const eventId = `${input.messageSid}:${input.messageStatus}:${hash.slice(0, 16)}`;
  const event = await supabase.from("customer_communication_webhook_events").upsert(
    {
      provider: "twilio",
      provider_event_id: eventId,
      event_type: `message.${input.messageStatus}`,
      provider_message_id: input.messageSid,
      customer_message_id: updated?.id ?? null,
      occurred_at: occurredAt,
      payload_hash: hash,
      processing_status: updated ? "processed" : "ignored",
      error_code: updated ? null : "unknown_provider_message",
      processed_at: occurredAt,
    },
    { onConflict: "provider,provider_event_id", ignoreDuplicates: true },
  );
  if (event.error) throw new Error("status_webhook_event_failed");
}
