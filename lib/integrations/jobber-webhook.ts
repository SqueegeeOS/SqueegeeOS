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

export interface JobberWebhookReconciliationResult {
  pendingEventsReconciled: number;
  staleProcessingEventsReconciled: number;
}

export function parseJobberWebhookPayload(
  rawPayload: string,
): JobberWebhookPayload | null {
  try {
    const payload = JSON.parse(rawPayload) as
      | Partial<JobberWebhookPayload>
      | {
          data?: { webHookEvent?: Partial<JobberWebhookPayload> };
        };
    const value =
      "data" in payload && payload.data?.webHookEvent
        ? payload.data.webHookEvent
        : (payload as Partial<JobberWebhookPayload>);
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

/**
 * Marks only events that existed before a successfully completed full snapshot
 * as reconciled. Events received after the snapshot started remain queued for
 * the next run, so a concurrent provider change cannot be acknowledged early.
 */
export async function markJobberWebhookEventsReconciled(input: {
  snapshotStartedAt: string;
  syncSummary: unknown;
  staleProcessingBefore?: string;
}): Promise<JobberWebhookReconciliationResult> {
  const supabase = createServiceRoleSupabaseClient();
  const processedAt = new Date().toISOString();
  const syncSummary = {
    reason: "covered_by_completed_full_snapshot",
    result: input.syncSummary,
  };
  const pending = await supabase
    .from("jobber_webhook_events")
    .update({
      status: "processed",
      sync_summary: syncSummary,
      error_code: null,
      processed_at: processedAt,
    })
    .in("status", ["received", "failed"])
    .lte("received_at", input.snapshotStartedAt)
    .select("event_key");
  if (pending.error) throw new Error(pending.error.message);

  const staleProcessingBefore =
    input.staleProcessingBefore ??
    new Date(Date.now() - 5 * 60_000).toISOString();
  const stale = await supabase
    .from("jobber_webhook_events")
    .update({
      status: "processed",
      sync_summary: syncSummary,
      error_code: null,
      processed_at: processedAt,
    })
    .eq("status", "processing")
    .lte("received_at", input.snapshotStartedAt)
    .lt("updated_at", staleProcessingBefore)
    .select("event_key");
  if (stale.error) throw new Error(stale.error.message);

  return {
    pendingEventsReconciled: pending.data?.length ?? 0,
    staleProcessingEventsReconciled: stale.data?.length ?? 0,
  };
}
