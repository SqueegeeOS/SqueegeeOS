import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import { loadGrowthTruthSnapshot } from "@/lib/admin/growth-command-center-server";

export async function GET(request: Request) {
  if (!authorizeAdminRequest(request.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(await loadGrowthTruthSnapshot());
}
