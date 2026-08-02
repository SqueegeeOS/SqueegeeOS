import "server-only";

import { createHash } from "crypto";
import type { CustomerMessageDeliveryStatus } from "@/lib/communications/types";
import { normalizeProviderDeliveryStatus } from "@/lib/communications/providers/contracts";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";

export interface ResendDeliveryWebhook {
  type: string;
  created_at: string;
  data: {
    email_id?: string;
  };
}

export function parseResendDeliveryWebhook(
  rawPayload: string,
): ResendDeliveryWebhook | null {
  try {
    const value = JSON.parse(rawPayload) as Partial<ResendDeliveryWebhook>;
    if (
      typeof value.type !== "string" ||
      typeof value.created_at !== "string" ||
      !value.data ||
      typeof value.data !== "object"
    ) {
      return null;
    }
    return value as ResendDeliveryWebhook;
  } catch {
    return null;
  }
}

export function customerMessageStatusForResendEvent(
  eventType: string,
): CustomerMessageDeliveryStatus | null {
  const status = normalizeProviderDeliveryStatus(eventType);
  switch (status) {
    case "accepted":
    case "queued":
    case "sending":
    case "sent":
    case "delivered":
    case "opened":
    case "clicked":
    case "read":
    case "bounced":
    case "complained":
    case "failed":
      return status;
    case "delayed":
      return "delivery_delayed";
    case "undelivered":
      return "failed";
    case "canceled":
      return "cancelled";
    default:
      return null;
  }
}

function maskEmail(address: string): string {
  const [local, domain] = address.split("@");
  return local && domain ? `${local.slice(0, 1)}***@${domain}` : "***";
}

async function suppressFailedEmailDestination(input: {
  supabase: ReturnType<typeof createServiceRoleSupabaseClient>;
  message: {
    contact_point_id?: string | null;
    conversation_id?: string | null;
    recipient_address_normalized?: string | null;
  };
  status: "bounced" | "complained";
  occurredAt: string;
}): Promise<void> {
  const contactUpdate =
    input.status === "complained"
      ? {
          consent_status: "opted_out",
          consent_source: "resend_complaint",
          consent_recorded_at: input.occurredAt,
          opt_out_reason: "provider_complaint",
        }
      : {
          verification_status: "invalid",
          verified_at: null,
        };

  if (input.message.contact_point_id) {
    const result = await input.supabase
      .from("customer_contact_points")
      .update(contactUpdate)
      .eq("id", input.message.contact_point_id);
    if (result.error) throw new Error("email_destination_suppression_failed");
    return;
  }

  if (!input.message.conversation_id) {
    throw new Error("email_destination_conversation_missing");
  }
  const conversation = await input.supabase
    .from("customer_conversations")
    .select("homeowner_id, lead_intake_id")
    .eq("id", input.message.conversation_id)
    .maybeSingle();
  if (conversation.error || !conversation.data) {
    throw new Error("email_destination_conversation_unavailable");
  }
  const identity = conversation.data as {
    homeowner_id?: string | null;
    lead_intake_id?: string | null;
  };

  if (identity.lead_intake_id) {
    const lead = await input.supabase
      .from("lead_intakes")
      .update({
        email_delivery_status: input.status,
        email_delivery_status_recorded_at: input.occurredAt,
      })
      .eq("id", identity.lead_intake_id);
    if (lead.error) throw new Error("lead_email_suppression_failed");
    return;
  }

  const address = input.message.recipient_address_normalized?.trim().toLowerCase();
  if (!identity.homeowner_id || !address) {
    throw new Error("homeowner_email_suppression_identity_missing");
  }
  const existing = await input.supabase
    .from("customer_contact_points")
    .select("id, homeowner_id")
    .eq("channel", "email")
    .eq("address_normalized", address)
    .maybeSingle();
  if (existing.error) throw new Error("email_contact_lookup_failed");
  if (existing.data) {
    if (existing.data.homeowner_id !== identity.homeowner_id) {
      throw new Error("email_contact_identity_ambiguous");
    }
    const updated = await input.supabase
      .from("customer_contact_points")
      .update(contactUpdate)
      .eq("id", existing.data.id);
    if (updated.error) throw new Error("email_contact_update_failed");
    return;
  }

  const inserted = await input.supabase.from("customer_contact_points").insert({
    homeowner_id: identity.homeowner_id,
    channel: "email",
    address_normalized: address,
    address_masked: maskEmail(address),
    is_primary: false,
    ...(input.status === "bounced"
      ? { verification_status: "invalid", verified_at: null }
      : {
          consent_status: "opted_out",
          consent_source: "resend_complaint",
          consent_recorded_at: input.occurredAt,
          opt_out_reason: "provider_complaint",
        }),
  });
  if (inserted.error) throw new Error("email_contact_insert_failed");
}

export async function recordResendDeliveryWebhook(input: {
  svixId: string;
  rawPayload: string;
  event: ResendDeliveryWebhook;
}): Promise<void> {
  const occurredAt = new Date(input.event.created_at);
  if (!Number.isFinite(occurredAt.getTime())) return;
  const supabase = createServiceRoleSupabaseClient();
  const payloadHash = createHash("sha256")
    .update(input.rawPayload, "utf8")
    .digest("hex");
  const { error } = await supabase.rpc("apply_resend_delivery_event", {
    p_svix_id: input.svixId,
    p_event_type: input.event.type,
    p_provider_message_id: input.event.data.email_id ?? null,
    p_occurred_at: occurredAt.toISOString(),
    p_payload_hash: payloadHash,
  });
  if (error) {
    console.error("[resend-webhook] delivery event persistence failed", {
      eventType: input.event.type,
      reason: error.message,
    });
  }

  const providerMessageId = input.event.data.email_id?.trim() ?? "";
  const nextStatus = customerMessageStatusForResendEvent(input.event.type);
  if (!providerMessageId || !nextStatus) return;

  const messageResult = await supabase
    .from("customer_messages")
    .select("id, contact_point_id, conversation_id, recipient_address_normalized, provider_event_at")
    .eq("provider", "resend")
    .eq("provider_message_id", providerMessageId)
    .maybeSingle();
  const message = messageResult.data as {
    id?: string;
    contact_point_id?: string | null;
    conversation_id?: string | null;
    recipient_address_normalized?: string | null;
    provider_event_at?: string | null;
  } | null;
  if (messageResult.error) throw new Error("customer_message_lookup_failed");
  const staleEvent = Boolean(
    message?.provider_event_at &&
      new Date(message.provider_event_at).getTime() > occurredAt.getTime(),
  );

  const { error: eventError } = await supabase
    .from("customer_communication_webhook_events")
    .upsert(
      {
        provider: "resend",
        provider_event_id: input.svixId,
        event_type: input.event.type,
        provider_message_id: providerMessageId,
        customer_message_id: message?.id ?? null,
        occurred_at: occurredAt.toISOString(),
        payload_hash: payloadHash,
        processing_status: message?.id ? "processed" : "ignored",
        processed_at: new Date().toISOString(),
      },
      {
        onConflict: "provider,provider_event_id",
        ignoreDuplicates: true,
      },
    );
  if (eventError) {
    throw new Error("customer_event_ledger_failed");
  }

  if (!message?.id || staleEvent) return;
  const update: Record<string, string> = {
    delivery_status: nextStatus,
    provider_event_at: occurredAt.toISOString(),
  };
  if (["delivered", "opened", "clicked", "read"].includes(nextStatus)) {
    update.delivered_at = occurredAt.toISOString();
  }
  const { error: updateError } = await supabase
    .from("customer_messages")
    .update(update)
    .eq("id", message.id);
  if (updateError) {
    throw new Error("customer_message_status_update_failed");
  }

  if (nextStatus === "bounced" || nextStatus === "complained") {
    await suppressFailedEmailDestination({
      supabase,
      message,
      status: nextStatus,
      occurredAt: occurredAt.toISOString(),
    });
  }
}
