import "server-only";

import { createHash } from "node:crypto";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";

export type CommunicationProvider = "resend" | "twilio";

function webhookSecret(provider: CommunicationProvider): string {
  return (
    provider === "resend"
      ? process.env.RESEND_WEBHOOK_SECRET
      : process.env.TWILIO_AUTH_TOKEN
  )?.trim() ?? "";
}

export function currentCommunicationWebhookFingerprint(
  provider: CommunicationProvider,
): string | null {
  const secret = webhookSecret(provider);
  return secret
    ? createHash("sha256").update(secret, "utf8").digest("hex")
    : null;
}

export async function recordCommunicationWebhookVerification(input: {
  provider: CommunicationProvider;
  eventType: string;
}): Promise<void> {
  const fingerprint = currentCommunicationWebhookFingerprint(input.provider);
  if (!fingerprint) {
    throw new Error(`${input.provider}_webhook_secret_missing`);
  }
  const verifiedAt = new Date().toISOString();
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase
    .from("customer_communication_provider_verifications")
    .upsert(
      {
        provider: input.provider,
        webhook_verified_at: verifiedAt,
        webhook_secret_fingerprint: fingerprint,
        last_event_type: input.eventType.slice(0, 160),
        updated_at: verifiedAt,
      },
      { onConflict: "provider" },
    );
  if (error) throw new Error(`${input.provider}_webhook_verification_failed`);
}

export async function getCommunicationAutomationReadiness(
  provider: CommunicationProvider,
): Promise<{ ready: boolean; reason: string | null }> {
  const fingerprint = currentCommunicationWebhookFingerprint(provider);
  if (!fingerprint) {
    return { ready: false, reason: "webhook_secret_missing" };
  }

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("customer_communication_provider_verifications")
    .select("webhook_verified_at, webhook_secret_fingerprint")
    .eq("provider", provider)
    .maybeSingle();
  if (error) return { ready: false, reason: "verification_schema_unavailable" };
  if (!data?.webhook_verified_at) {
    return { ready: false, reason: "signed_webhook_not_seen" };
  }
  if (data.webhook_secret_fingerprint !== fingerprint) {
    return { ready: false, reason: "current_webhook_secret_not_verified" };
  }
  return { ready: true, reason: null };
}
