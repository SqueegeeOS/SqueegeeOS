import { NextResponse } from "next/server";
import { loadMembershipCommandCenter } from "@/lib/admin/membership-command-center-server";
import { authorizeAdminRequest } from "@/lib/admin/pin";

export async function GET(request: Request) {
  const pinHeader = request.headers.get("x-admin-pin");

  if (!authorizeAdminRequest(pinHeader)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const workspace = await loadMembershipCommandCenter();
    return NextResponse.json(workspace);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load membership command center";
    console.error("[membership-command-center] load failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
