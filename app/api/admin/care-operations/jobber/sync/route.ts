import { processPendingJobberWebhooks } from "@/lib/integrations/jobber-webhook";
import { JobberSyncBusyError } from "@/lib/care-operations/jobber-sync-lease";
import { after, NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import { syncAllJobberData } from "@/lib/care-operations/jobber-full-sync";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!authorizeAdminRequest(request.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await syncAllJobberData());
  } catch (error) {
    if (error instanceof JobberSyncBusyError) {
      return NextResponse.json({ error: error.message }, { status: 409, headers: { "Cache-Control": "no-store", "Retry-After": "15" } });
    }
    const message = error instanceof Error ? error.message : "Synchronization failed";
    console.error("[jobber-sync] full read-only sync failed:", message);
    return NextResponse.json(
      {
        error:
          "Jobber synchronization did not finish. Existing HomeAtlas data was not deleted; retry after checking the connection.",
      },
      { status: 502 },
    );
  } finally {
    // Recover events received while this request owned the shared sync lease.
    after(() => processPendingJobberWebhooks());
  }
}
