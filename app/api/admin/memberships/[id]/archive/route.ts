import { NextResponse } from "next/server";
import {
  archiveMembership,
  validateArchiveMembershipInput,
  type ArchiveMembershipInput,
} from "@/lib/admin/archive-membership";
import { authorizeAdminRequest } from "@/lib/admin/pin";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const pinHeader = request.headers.get("x-admin-pin");
  if (!authorizeAdminRequest(pinHeader)) {
    return unauthorized();
  }

  const { id } = await context.params;

  let body: Pick<ArchiveMembershipInput, "reason"> = {};
  try {
    const text = await request.text();
    if (text.trim()) {
      body = JSON.parse(text) as Pick<ArchiveMembershipInput, "reason">;
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const input: ArchiveMembershipInput = {
    membershipId: id,
    reason: body.reason,
  };

  const validationError = validateArchiveMembershipInput(input);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const result = await archiveMembership(input);
    return NextResponse.json({
      ...result,
      message:
        "Membership archived. Signed agreements and billing history are preserved; Stripe was not modified.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to archive membership";
    const status = message.includes("already archived")
      ? 409
      : message.includes("not found")
        ? 404
        : 500;
    console.error("[memberships/archive] failed:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
