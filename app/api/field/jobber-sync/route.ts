import { NextResponse } from "next/server";
import { syncAllJobberVisits } from "@/lib/care-operations/jobber-visit-sync";
import { authorizeFieldRequest } from "@/lib/field-operations/field-access";
import { reconcilePendingLiveDispatchJobs } from "@/lib/field-operations/live-dispatch-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
};

export async function POST(request: Request) {
  const actor = await authorizeFieldRequest(request.headers);
  if (!actor || actor.kind !== "technician") {
    return NextResponse.json(
      { error: "Technician Field Pass required" },
      { status: 401, headers: PRIVATE_HEADERS },
    );
  }

  try {
    const sync = await syncAllJobberVisits();
    const reconciliation = await reconcilePendingLiveDispatchJobs().catch(
      () => ({ reconciled: 0, warnings: ["Live dispatch reconciliation is still pending."] }),
    );

    return NextResponse.json(
      {
        ok: true,
        syncedAt: new Date().toISOString(),
        observedVisits: sync.observed,
        insertedVisits: sync.inserted,
        changedVisits: sync.changed,
        reconciledLiveJobs: reconciliation.reconciled,
        warning: reconciliation.warnings[0] ?? null,
      },
      { headers: PRIVATE_HEADERS },
    );
  } catch (error) {
    console.error("[field-jobber-sync] technician refresh failed", {
      technician: actor.jobberUserId,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      {
        error:
          "Jobber could not refresh right now. Your existing HomeAtlas work is still saved; try again or ask HQ if the route is still stale.",
      },
      { status: 503, headers: PRIVATE_HEADERS },
    );
  }
}
