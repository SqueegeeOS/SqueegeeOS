import { NextResponse } from "next/server";
import { buildAdminDashboard } from "@/lib/admin/build-dashboard";
import { authorizeAdminRequest } from "@/lib/admin/pin";

export async function GET(request: Request) {
  const privateBeta = !process.env.NEXT_PUBLIC_ADMIN_PIN?.trim();
  const pinHeader = request.headers.get("x-admin-pin");

  if (!authorizeAdminRequest(pinHeader)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dashboard = await buildAdminDashboard([], privateBeta);
  return NextResponse.json(dashboard);
}
