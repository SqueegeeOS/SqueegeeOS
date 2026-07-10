import { NextResponse } from "next/server";
import {
  scheduleMembershipService,
  validateScheduleMembershipServiceInput,
  type ScheduleMembershipServiceInput,
} from "@/lib/admin/schedule-membership-service";
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

  let body: Pick<
    ScheduleMembershipServiceInput,
    "serviceDate" | "timeWindow" | "note" | "appointmentType"
  >;
  try {
    body = (await request.json()) as Pick<
      ScheduleMembershipServiceInput,
      "serviceDate" | "timeWindow" | "note" | "appointmentType"
    >;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const input: ScheduleMembershipServiceInput = {
    membershipId: id,
    serviceDate: body.serviceDate ?? "",
    timeWindow: body.timeWindow,
    note: body.note,
    appointmentType: body.appointmentType,
  };

  const validationError = validateScheduleMembershipServiceInput(input);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const result = await scheduleMembershipService(input);
    return NextResponse.json({
      ...result,
      message: "Next service scheduled.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to schedule service";
    const status = message.includes("not found")
      ? 404
      : message.includes("cannot be scheduled") ||
          message.includes("card on file")
        ? 409
        : 500;
    console.error("[memberships/schedule] failed:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
