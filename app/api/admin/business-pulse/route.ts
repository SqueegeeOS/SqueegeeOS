import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import {
  isBusinessPulsePeriod,
  type BusinessPulsePeriod,
} from "@/lib/admin/business-pulse";
import { loadBusinessPulseSnapshot } from "@/lib/admin/business-pulse-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!authorizeAdminRequest(request.headers)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const requested = new URL(request.url).searchParams.get("period");
  const period: BusinessPulsePeriod = isBusinessPulsePeriod(requested)
    ? requested
    : "current_month";
  const snapshot = await loadBusinessPulseSnapshot(period);
  return NextResponse.json(snapshot, {
    headers: { "Cache-Control": "no-store" },
  });
}
