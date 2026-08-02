import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { syncAllJobberData } from "@/lib/care-operations/jobber-full-sync";
import { markJobberWebhookEventsReconciled } from "@/lib/integrations/jobber-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");
  const actual = Buffer.from(request.headers.get("authorization") ?? "", "utf8");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const snapshotStartedAt = new Date().toISOString();
  try {
    const sync = await syncAllJobberData();
    const webhookInbox = await markJobberWebhookEventsReconciled({
      snapshotStartedAt,
      syncSummary: sync,
    });
    return NextResponse.json(
      { ok: true, sync, webhookInbox },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[jobber-reconcile-cron] reconciliation failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "Jobber reconciliation failed" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
