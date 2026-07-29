import "server-only";

import { createHash } from "crypto";
import { syncAllJobberClients } from "@/lib/care-operations/jobber-customer-matching";
import { getFreshJobberAccessToken, readJobberConnectionStatus } from "@/lib/care-operations/jobber-connection-store";
import { syncAllJobberData } from "@/lib/care-operations/jobber-full-sync";
import { syncAllJobberVisits } from "@/lib/care-operations/jobber-visit-sync";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";

export interface JobberWebhookPayload {
  topic: string;
  appId?: string;
  accountId?: string;
  itemId?: string;
  occurredAt?: string;
}

type JobberWebhookSyncScope = "clients" | "visits" | "full" | "ignored";

export function parseJobberWebhookPayload(
  rawPayload: string,
): JobberWebhookPayload | null {
  try {
    const value = JSON.parse(rawPayload) as Partial<JobberWebhookPayload>;
    if (typeof value.topic !== "string" || !value.topic.trim()) return null;
    return value as JobberWebhookPayload;
  } catch {
    return null;
  }
}

export function jobberWebhookSyncScope(topic: string): JobberWebhookSyncScope {
  const normalized = topic.trim().toUpperCase();
  if (normalized.includes("CLIENT")) return "clients";
  if (normalized.includes("VISIT") || normalized.includes("JOB")) return "visits";
  if (normalized.includes("PROPERTY")) return "full";
  return "ignored";
}

function safeErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : "unknown";
  if (message.includes("not connected")) return "jobber_not_connected";
  if (message.includes("refresh")) return "jobber_refresh_failed";
  if (message.includes("rate")) return "jobber_rate_limited";
  return "jobber_sync_failed";
}

export async function recordAndProcessJobberWebhook(input: {
  rawPayload: string;
  event: JobberWebhookPayload;
}): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const payloadHash = createHash("sha256")
    .update(input.rawPayload, "utf8")
    .digest("hex");
  const eventKey = payloadHash;
  const syncScope = jobberWebhookSyncScope(input.event.topic);
  const occurredAt = input.event.occurredAt
    ? new Date(input.event.occurredAt)
    : null;

  const insert = await supabase
    .from("jobber_webhook_events")
    .insert({
      event_key: eventKey,
      topic: input.event.topic,
      app_id: input.event.appId ?? null,
      account_id: input.event.accountId ?? null,
      item_id: input.event.itemId ?? null,
      occurred_at:
        occurredAt && Number.isFinite(occurredAt.getTime())
          ? occurredAt.toISOString()
          : null,
      payload_hash: payloadHash,
      sync_scope: syncScope,
      status: "received",
    })
    .select("event_key")
    .maybeSingle();

  if (insert.error?.code === "23505") return;
  if (insert.error) {
    console.error("[jobber-webhook] event persistence failed", {
      topic: input.event.topic,
      reason: insert.error.message,
    });
    return;
  }
  if (syncScope === "ignored") {
    await supabase
      .from("jobber_webhook_events")
      .update({ status: "ignored", processed_at: new Date().toISOString() })
      .eq("event_key", eventKey);
    return;
  }

  try {
    const connection = await readJobberConnectionStatus();
    if (
      input.event.accountId &&
      connection.accountId &&
      input.event.accountId !== connection.accountId
    ) {
      await supabase
        .from("jobber_webhook_events")
        .update({
          status: "ignored",
          error_code: "account_mismatch",
          processed_at: new Date().toISOString(),
        })
        .eq("event_key", eventKey);
      return;
    }

    const coalesceSince = new Date(Date.now() - 2 * 60_000).toISOString();
    const recent = await supabase
      .from("jobber_webhook_events")
      .select("event_key")
      .eq("sync_scope", syncScope)
      .in("status", ["processing", "processed"])
      .neq("event_key", eventKey)
      .gte("received_at", coalesceSince)
      .limit(1)
      .maybeSingle();
    if (recent.data) {
      await supabase
        .from("jobber_webhook_events")
        .update({
          status: "ignored",
          sync_summary: { reason: "coalesced_with_recent_sync" },
          processed_at: new Date().toISOString(),
        })
        .eq("event_key", eventKey);
      return;
    }

    await supabase
      .from("jobber_webhook_events")
      .update({ status: "processing" })
      .eq("event_key", eventKey);

    let syncSummary: unknown;
    if (syncScope === "full") {
      syncSummary = await syncAllJobberData();
    } else {
      const accessToken = await getFreshJobberAccessToken();
      syncSummary =
        syncScope === "clients"
          ? await syncAllJobberClients(accessToken)
          : await syncAllJobberVisits(accessToken);
    }
    await supabase
      .from("jobber_webhook_events")
      .update({
        status: "processed",
        sync_summary: syncSummary,
        error_code: null,
        processed_at: new Date().toISOString(),
      })
      .eq("event_key", eventKey);
  } catch (error) {
    const errorCode = safeErrorCode(error);
    console.error("[jobber-webhook] background sync failed", {
      topic: input.event.topic,
      errorCode,
    });
    await supabase
      .from("jobber_webhook_events")
      .update({
        status: "failed",
        error_code: errorCode,
        processed_at: new Date().toISOString(),
      })
      .eq("event_key", eventKey);
  }
}
