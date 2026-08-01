import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import { loadJobberTodayBoard } from "@/lib/care-operations/jobber-today";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!authorizeAdminRequest(request.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await loadJobberTodayBoard());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Today board failed";
    console.error("[jobber-today] load failed:", message);
    return NextResponse.json(
      { error: "Could not load today's Jobber schedule." },
      { status: 503 },
    );
  }
}
