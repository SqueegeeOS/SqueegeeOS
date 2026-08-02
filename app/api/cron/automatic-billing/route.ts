import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runAutomaticMembershipBilling } from "@/lib/billing/automatic-billing-executor";
import { isFirstBusinessDay } from "@/lib/billing/automatic-billing-settings";
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

  const requestStartedAt = Date.now();
  const referenceDate = new Date(requestStartedAt);
  if (!isFirstBusinessDay(referenceDate)) {
    return NextResponse.json(
      { ok: true, status: "not_due" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const snapshotStartedAt = referenceDate.toISOString();
  try {
    // Billing is allowed only after a successful fresh Jobber snapshot. A
    // stale projection could otherwise charge for a visit canceled upstream.
    const sync = await syncAllJobberData();
    const webhookInbox = await markJobberWebhookEventsReconciled({
      snapshotStartedAt,
      syncSummary: sync,
    });
    const billing = await runAutomaticMembershipBilling({
      triggerSource: "cron",
      actor: "vercel_first_of_month_billing_cron",
      referenceDate,
      stopClaimingAt: requestStartedAt + 270_000,
    });
    return NextResponse.json(
      { ok: true, sync, webhookInbox, billing },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[automatic-billing-cron] run failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      {
        error:
          "First-of-month billing stopped before charging from unverified Jobber data.",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
