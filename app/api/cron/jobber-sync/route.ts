import { timingSafeEqual } from "node:crypto";
import { after, NextResponse } from "next/server";
import { syncAllJobberData } from "@/lib/care-operations/jobber-full-sync";
import { JobberSyncBusyError, withJobberSyncLease } from "@/lib/care-operations/jobber-sync-lease";
import { markJobberWebhookEventsReconciled, processPendingJobberWebhooks } from "@/lib/integrations/jobber-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
const HEADERS = { "Cache-Control": "no-store" };

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");
  const actual = Buffer.from(request.headers.get("authorization") ?? "", "utf8");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Projection repair only: never run billing, texts, reviews, or geocoding here. */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: HEADERS });
  }
  const startedAt = Date.now();
  try {
    const result = await withJobberSyncLease(async () => {
      const snapshotStartedAt = new Date().toISOString();
      const sync = await syncAllJobberData();
      const webhookInbox = await markJobberWebhookEventsReconciled({ snapshotStartedAt, syncSummary: sync });
      return { sync, webhookInbox };
    });
    console.info("[jobber-sync-cron] completed", {
      durationMs: Date.now() - startedAt,
      clients: result.sync.clients.observed,
      visits: result.sync.visits.observed,
    });
    return NextResponse.json({ ok: true, ...result }, { headers: HEADERS });
  } catch (error) {
    if (error instanceof JobberSyncBusyError) {
      return NextResponse.json({ ok: true, skipped: "sync_in_progress" }, { status: 202, headers: HEADERS });
    }
    console.error("[jobber-sync-cron] failed", { reason: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "Jobber backup sync failed" }, { status: 500, headers: HEADERS });
  } finally {
    // A webhook received during our snapshot could not acquire the lease.
    // Wake its durable inbox after release, including after a transient failure.
    after(() => processPendingJobberWebhooks());
  }
}
