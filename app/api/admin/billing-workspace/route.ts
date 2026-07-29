import { NextResponse } from "next/server";
import { loadBillingWorkspace } from "@/lib/admin/billing-workspace-server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";

export async function GET(request: Request) {
  const authHeaders = request.headers;

  if (!authorizeAdminRequest(authHeaders)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const workspace = await loadBillingWorkspace();
    return NextResponse.json(workspace);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load billing workspace";
    console.error("[billing-workspace] load failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
