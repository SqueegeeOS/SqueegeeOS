import { NextResponse } from "next/server";
import { getLeadIntakeById } from "@/lib/acquisition/leads/repository";
import { authorizeAdminRequest } from "@/lib/admin/pin";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const pinHeader = request.headers.get("x-admin-pin");
  if (!authorizeAdminRequest(pinHeader)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const lead = await getLeadIntakeById(id);
    if (!lead) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ lead });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load lead intake";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
