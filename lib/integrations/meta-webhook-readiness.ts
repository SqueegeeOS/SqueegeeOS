import "server-only";

import { createHash } from "node:crypto";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";

type MetaWebhookProofKind = "callback_challenge" | "signed_event";

export interface MetaWebhookProofReadiness {
  available: boolean;
  callbackChallengeVerified: boolean;
  signedWebhookVerified: boolean;
}

function currentSecret(kind: MetaWebhookProofKind): string {
  return (
    kind === "callback_challenge"
      ? process.env.META_WEBHOOK_VERIFY_TOKEN
      : process.env.META_APP_SECRET
  )?.trim() ?? "";
}

function proofId(kind: MetaWebhookProofKind, secret: string): string {
  const fingerprint = createHash("sha256").update(secret, "utf8").digest("hex");
  return `readiness:${kind}:${fingerprint}`;
}

function currentProofId(kind: MetaWebhookProofKind): string | null {
  const secret = currentSecret(kind);
  return secret ? proofId(kind, secret) : null;
}

export async function recordCurrentMetaWebhookProof(input: {
  kind: MetaWebhookProofKind;
  payload: string;
}): Promise<void> {
  const secret = currentSecret(input.kind);
  if (!secret) throw new Error(`meta_${input.kind}_secret_missing`);
  const recordedAt = new Date().toISOString();
  const payloadHash = createHash("sha256")
    .update(input.payload, "utf8")
    .digest("hex");
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase
    .from("customer_communication_webhook_events")
    .upsert(
      {
        provider: "meta",
        provider_event_id: proofId(input.kind, secret),
        event_type:
          input.kind === "callback_challenge"
            ? "callback_challenge_verified"
            : "signed_webhook_verified",
        payload_hash: payloadHash,
        processing_status: "processed",
        error_code: null,
        received_at: recordedAt,
        processed_at: recordedAt,
      },
      { onConflict: "provider,provider_event_id" },
    );
  if (error) throw new Error(`meta_${input.kind}_proof_failed`);
}

export async function readCurrentMetaWebhookProof(): Promise<MetaWebhookProofReadiness> {
  const challengeId = currentProofId("callback_challenge");
  const signedEventId = currentProofId("signed_event");
  const ids = [challengeId, signedEventId].filter(
    (value): value is string => Boolean(value),
  );
  if (ids.length === 0) {
    return {
      available: true,
      callbackChallengeVerified: false,
      signedWebhookVerified: false,
    };
  }

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("customer_communication_webhook_events")
    .select("provider_event_id")
    .eq("provider", "meta")
    .in("provider_event_id", ids);
  if (error) {
    return {
      available: false,
      callbackChallengeVerified: false,
      signedWebhookVerified: false,
    };
  }
  const observedIds = new Set(
    (data ?? []).map((row) => String(row.provider_event_id)),
  );
  return {
    available: true,
    callbackChallengeVerified: Boolean(challengeId && observedIds.has(challengeId)),
    signedWebhookVerified: Boolean(signedEventId && observedIds.has(signedEventId)),
  };
}
