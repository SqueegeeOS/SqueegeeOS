import { NextResponse } from "next/server";
import { listLeadIntakes } from "@/lib/acquisition/leads/repository";
import { authorizeAdminRequest } from "@/lib/admin/pin";

export async function GET(request: Request) {
  const pinHeader = request.headers.get("x-admin-pin");
  if (!authorizeAdminRequest(pinHeader)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const leads = await listLeadIntakes();
    return NextResponse.json({ leads });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load lead intakes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
