import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/pin";
import {
  validateCompleteChargeVisitInput,
  type CompleteChargeVisitInput,
} from "@/lib/admin/complete-charge-visit-shared";
import { completeAndChargeVisit } from "@/lib/admin/complete-charge-visit";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!authorizeAdminRequest(request.headers.get("x-admin-pin"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Omit<CompleteChargeVisitInput, "membershipId">;
  try {
    body = (await request.json()) as Omit<
      CompleteChargeVisitInput,
      "membershipId"
    >;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { id } = await context.params;
  const input: CompleteChargeVisitInput = {
    membershipId: id,
    appointmentId: body.appointmentId,
    serviceDate: body.serviceDate ?? "",
    lines: body.lines ?? [],
    internalNote: body.internalNote,
  };
  const validationError = validateCompleteChargeVisitInput(input);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const result = await completeAndChargeVisit(input);
    return NextResponse.json(result, {
      status: result.outcome === "declined" ? 402 : 200,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to complete visit";
    const status = message.includes("not found")
      ? 404
      : message.includes("saved card") || message.includes("active membership")
        ? 409
        : message.includes("paused") ||
            message.includes("verified against Jobber") ||
            message.includes("execution is disabled")
          ? 409
        : message.includes("not configured") || message.includes("not connected")
          ? 503
          : 500;
    console.error("[complete-charge-visit] failed:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
