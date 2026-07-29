import { NextResponse } from "next/server";
import { buildAdminDashboard } from "@/lib/admin/build-dashboard";
import {
  authorizeAdminRequest,
  isAdminPrivateBetaEnabled,
} from "@/lib/admin/server-auth";

export async function GET(request: Request) {
  const privateBeta = isAdminPrivateBetaEnabled();
  const authHeaders = request.headers;

  if (!authorizeAdminRequest(authHeaders)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dashboard = await buildAdminDashboard([], privateBeta);
  return NextResponse.json(dashboard);
}
