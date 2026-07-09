import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/pin";
import { runProductionHealthReport } from "@/lib/admin/production-health-server";

export async function GET(request: Request) {
  const pinHeader = request.headers.get("x-admin-pin");

  if (!authorizeAdminRequest(pinHeader)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const report = await runProductionHealthReport();
    return NextResponse.json(report);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to run production health";
    console.error("[production-health] failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
