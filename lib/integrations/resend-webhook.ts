import "server-only";

import { createHash } from "crypto";
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

export async function recordResendDeliveryWebhook(input: {
  svixId: string;
  rawPayload: string;
  event: ResendDeliveryWebhook;
}): Promise<void> {
  const occurredAt = new Date(input.event.created_at);
  if (!Number.isFinite(occurredAt.getTime())) return;
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase.rpc("apply_resend_delivery_event", {
    p_svix_id: input.svixId,
    p_event_type: input.event.type,
    p_provider_message_id: input.event.data.email_id ?? null,
    p_occurred_at: occurredAt.toISOString(),
    p_payload_hash: createHash("sha256")
      .update(input.rawPayload, "utf8")
      .digest("hex"),
  });
  if (error) {
    console.error("[resend-webhook] delivery event persistence failed", {
      eventType: input.event.type,
      reason: error.message,
    });
  }
}
