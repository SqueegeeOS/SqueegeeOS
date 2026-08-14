import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import { loadCommunicationsLaunchReadiness } from "@/lib/communications/integration-launch-readiness";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!authorizeAdminRequest(request.headers)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  try {
    const readiness = await loadCommunicationsLaunchReadiness();
    return NextResponse.json(readiness, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("[communications-readiness] load failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "Communications readiness could not be loaded." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
