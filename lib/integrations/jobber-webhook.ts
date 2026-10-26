import "server-only";

import { createHash, randomUUID } from "crypto";
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
    for (const key of ["appId", "accountId", "itemId", "occurredAt"] as const) {
      if (value[key] !== undefined && (typeof value[key] !== "string" || !value[key]?.trim())) return null;
    }
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
  if (/rate|throttl|429/.test(message)) return "jobber_rate_limited";
  return "jobber_sync_failed";
}

/** Persist before responding to Jobber; duplicates must not reset completed work. */
export async function recordJobberWebhook(input: {
  rawPayload: string;
  event: JobberWebhookPayload;
}): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const payloadHash = createHash("sha256").update(input.rawPayload, "utf8").digest("hex");
  const syncScope = jobberWebhookSyncScope(input.event.topic);
  const occurredAt = input.event.occurredAt ? new Date(input.event.occurredAt) : null;
  const result = await supabase.from("jobber_webhook_events").upsert({
    event_key: payloadHash,
    topic: input.event.topic,
    app_id: input.event.appId ?? null,
    account_id: input.event.accountId ?? null,
    item_id: input.event.itemId ?? null,
    occurred_at: occurredAt && Number.isFinite(occurredAt.getTime()) ? occurredAt.toISOString() : null,
    payload_hash: payloadHash,
    sync_scope: syncScope,
    status: syncScope === "ignored" ? "ignored" : "received",
    processed_at: syncScope === "ignored" ? new Date().toISOString() : null,
  }, { onConflict: "event_key", ignoreDuplicates: true });
  if (result.error) throw new Error("Jobber webhook persistence failed");
}

interface ClaimedWebhookEvent {
  event_key: string;
  sync_scope: Exclude<JobberWebhookSyncScope, "ignored">;
}

interface WebhookBatchClaim {
  acquired: boolean;
  events: ClaimedWebhookEvent[];
}

async function syncWebhookBatch(events: ClaimedWebhookEvent[]): Promise<unknown> {
  const scopes = new Set(events.map((event) => event.sync_scope));
  if (scopes.has("full") || (scopes.has("clients") && scopes.has("visits"))) {
    return syncAllJobberData();
  }
  const accessToken = await getFreshJobberAccessToken();
  return scopes.has("clients")
    ? syncAllJobberClients(accessToken)
    : syncAllJobberVisits(accessToken);
}

/**
 * A database lease coalesces bursts across server instances, not just one process.
 * Only the exact claimed events are completed: later arrivals need a new snapshot.
 * Failed/stale deliveries are retried by the next wakeup, including duplicate
 * delivery. The daily full-snapshot repair remains the crash-recovery safety net.
 */
export async function processPendingJobberWebhooks(): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const leaseId = randomUUID();
  // Leave headroom for finalization; never start an unlimited polling worker.
  const stopClaimingAt = Date.now() + 180_000;
  let acquired = false;
  let consecutiveFailures = 0;
  try {
    const connection = await readJobberConnectionStatus();
    if (!connection.connected || !connection.accountId) {
      console.error("[jobber-webhook] account unavailable; durable events await recovery");
      return;
    }
    do {
      const claim = await supabase.rpc("claim_jobber_webhook_batch", {
        p_lease_id: leaseId,
        p_account_id: connection.accountId,
      });
      if (claim.error) throw new Error("Jobber webhook batch claim failed");
      const batch = claim.data as WebhookBatchClaim | null;
      if (!batch || !batch.acquired) return;
      acquired = true;
      if (!batch.events.length) return;

      const eventKeys = batch.events.map((event) => event.event_key);
      let summary: unknown = null;
      let errorCode: string | null = null;
      try {
        summary = await syncWebhookBatch(batch.events);
        consecutiveFailures = 0;
      } catch (error) {
        errorCode = safeErrorCode(error);
        consecutiveFailures += 1;
        console.error("[jobber-webhook] batch sync failed", { errorCode, eventCount: eventKeys.length });
      }
      const finished = await supabase.rpc("finish_jobber_webhook_batch", {
        p_lease_id: leaseId,
        p_event_keys: eventKeys,
        p_sync_summary: summary,
        p_error_code: errorCode,
      });
      if (finished.error) throw new Error("Jobber webhook batch finalization failed");
      // One short retry handles transient provider/network failures. Persistent
      // failures stay durable for the next webhook or daily reconciliation.
      if (errorCode) {
        if (consecutiveFailures >= 2 || Date.now() >= stopClaimingAt) return;
        await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
    } while (Date.now() < stopClaimingAt);
  } catch (error) {
    console.error("[jobber-webhook] worker failed; durable inbox retained", {
      errorCode: safeErrorCode(error),
    });
  } finally {
    if (acquired) {
      const release = await supabase.from("jobber_webhook_sync_leases")
        .update({ lease_id: null, expires_at: null })
        .eq("connection_id", "squeegeeking").eq("lease_id", leaseId);
      if (release.error) console.error("[jobber-webhook] lease release failed; expiry will recover it");
    }
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
