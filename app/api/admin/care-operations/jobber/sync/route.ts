import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import { syncAllJobberData } from "@/lib/care-operations/jobber-full-sync";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!authorizeAdminRequest(request.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await syncAllJobberData());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Synchronization failed";
    console.error("[jobber-sync] full read-only sync failed:", message);
    return NextResponse.json(
      {
        error:
          "Jobber synchronization did not finish. Existing HomeAtlas data was not deleted; retry after checking the connection.",
      },
      { status: 502 },
    );
  }
}
