import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";

// The same singleton used by claim_jobber_webhook_batch. All sync routes have
// a 300-second maximum; the extra 30 seconds prevents takeover during shutdown.
const LEASE_MS = 330_000;
const CONNECTION_ID = "squeegeeking";
const leaseContext = new AsyncLocalStorage<string>();

export class JobberSyncBusyError extends Error {
  constructor() {
    super("Jobber is already syncing. Please refresh again shortly.");
    this.name = "JobberSyncBusyError";
  }
}

/** Only the webhook worker may adopt an owner it has just claimed in the DB. */
export function withClaimedJobberSyncLease<T>(
  leaseId: string,
  work: () => Promise<T>,
): Promise<T> {
  return leaseContext.run(leaseId, work);
}

/**
 * Serialize complete snapshots, including nested client/visit passes. The
 * conditional UPDATE is atomic and competes on the same row lock as webhook
 * claims. Never overwrite an active owner or release another worker's lease.
 */
export interface JobberSyncLeaseOptions {
  /** Scheduled workflows may wait briefly; interactive/fallback callers skip. */
  waitForLeaseMs?: number;
}

export async function withJobberSyncLease<T>(
  work: () => Promise<T>,
  options: JobberSyncLeaseOptions = {},
): Promise<T> {
  if (leaseContext.getStore()) return work();

  const supabase = createServiceRoleSupabaseClient();
  const table = "jobber_webhook_sync_leases";
  const initialized = await supabase.from(table).upsert(
    { connection_id: CONNECTION_ID },
    { onConflict: "connection_id", ignoreDuplicates: true },
  );
  if (initialized.error) throw new Error("Jobber sync lease unavailable");

  const leaseId = randomUUID();
  const requestedWait = options.waitForLeaseMs ?? 0;
  const waitMs = Number.isFinite(requestedWait)
    ? Math.max(0, Math.min(90_000, requestedWait))
    : 0;
  const stopWaitingAt = Date.now() + waitMs;
  while (true) {
    const now = Date.now();
    const acquired = await supabase.from(table)
      .update({ lease_id: leaseId, expires_at: new Date(now + LEASE_MS).toISOString() })
      .eq("connection_id", CONNECTION_ID)
      .or(`lease_id.is.null,expires_at.lte.${new Date(now).toISOString()}`)
      .select("lease_id")
      .maybeSingle();
    if (acquired.error) throw new Error("Jobber sync lease claim failed");
    if (acquired.data) break;
    const remainingMs = stopWaitingAt - Date.now();
    if (remainingMs <= 0) throw new JobberSyncBusyError();
    await new Promise((resolve) => setTimeout(resolve, Math.min(1_000, remainingMs)));
  }

  try {
    return await withClaimedJobberSyncLease(leaseId, work);
  } finally {
    const releaseFailed = await supabase.from(table)
      .update({ lease_id: null, expires_at: null })
      .eq("connection_id", CONNECTION_ID)
      .eq("lease_id", leaseId)
      .then((result) => Boolean(result.error), () => true);
    if (releaseFailed) {
      // Do not replace the original sync outcome. Expiry recovers a failed release.
      console.error("[jobber-sync] lease release failed; expiry will recover it");
    }
  }
}
