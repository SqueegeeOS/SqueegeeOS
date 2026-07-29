import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import {
  loadAtlasPulseDashboard,
  loadAtlasPulseUniversalSearch,
} from "@/lib/activation/atlas-pulse-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!authorizeAdminRequest(request.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  try {
    if (url.searchParams.get("mode") === "search") {
      return NextResponse.json(
        await loadAtlasPulseUniversalSearch(url.searchParams.get("search") ?? ""),
      );
    }
    return NextResponse.json(await loadAtlasPulseDashboard());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Atlas Pulse could not load";
    console.error("[atlas-pulse] load failed:", message);
    return NextResponse.json(
      { error: "Atlas Pulse could not load live operating data." },
      { status: 503 },
    );
  }
}
