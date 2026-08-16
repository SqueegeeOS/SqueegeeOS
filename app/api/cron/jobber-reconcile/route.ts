import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { syncAllJobberData } from "@/lib/care-operations/jobber-full-sync";
import { processVerifiedAppointmentReminders } from "@/lib/communications/reminders";
import { processDueScheduledCommunications } from "@/lib/communications/service";
import { markJobberWebhookEventsReconciled } from "@/lib/integrations/jobber-webhook";
import { runAutomaticMembershipBilling } from "@/lib/billing/automatic-billing-executor";
import { qualifyDueSalesAttributions } from "@/lib/sales/attribution-lifecycle-server";
import { reconcileSignedMembershipAttributionsForActiveReps } from "@/lib/sales/signed-attribution-server";

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
  const snapshotStartedAt = new Date(requestStartedAt).toISOString();
  try {
    const signatureAttributionRepairs =
      await reconcileSignedMembershipAttributionsForActiveReps().catch((error) => {
        console.error(
          "[jobber-reconcile-cron] signed attribution repair failed",
          {
            reason: error instanceof Error ? error.message : "unknown",
          },
        );
        return {
          status: "failed" as const,
          error:
            "Signed attribution repair failed; Jobber reconciliation continued.",
        };
      });
    const retentionQualifications = await qualifyDueSalesAttributions({
      referenceDate: new Date(requestStartedAt),
    }).catch((error) => {
      console.error("[jobber-reconcile-cron] sales retention qualification failed", {
        reason: error instanceof Error ? error.message : "unknown",
      });
      return {
        status: "failed" as const,
        error:
          "Sales retention qualification failed; Jobber reconciliation continued.",
      };
    });
    const scheduledCommunications = await processDueScheduledCommunications().catch(
      (error) => {
        console.error("[jobber-reconcile-cron] scheduled communications failed", {
          reason: error instanceof Error ? error.message : "unknown",
        });
        return {
          status: "failed" as const,
          error:
            "Scheduled communications failed; fresh Jobber sync and billing safety checks continued.",
        };
      },
    );
    const sync = await syncAllJobberData();
    const webhookInbox = await markJobberWebhookEventsReconciled({
      snapshotStartedAt,
      syncSummary: sync,
    });
    const billing = await runAutomaticMembershipBilling({
      triggerSource: "cron",
      actor: "vercel_jobber_reconcile_cron",
      stopClaimingAt: requestStartedAt + 270_000,
    }).catch((error) => {
      console.error("[jobber-reconcile-cron] automatic billing failed", {
        reason: error instanceof Error ? error.message : "unknown",
      });
      return {
        status: "failed" as const,
        error: "Automatic billing failed; Jobber reconciliation still completed.",
      };
    });
    const reminders = await processVerifiedAppointmentReminders();
    return NextResponse.json(
      {
        ok: true,
        sync,
        webhookInbox,
        scheduledCommunications,
        signatureAttributionRepairs,
        retentionQualifications,
        billing,
        reminders,
      },
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
