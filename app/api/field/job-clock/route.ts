import { NextResponse } from "next/server";
import { authorizeFieldRequest } from "@/lib/field-operations/field-access";
import { assertFieldActorCanWriteAppointment } from "@/lib/field-operations/field-scope";
import { recordTechnicianJobClockAction } from "@/lib/field-operations/technician-job-clock-server";
import {
  validateTechnicianJobClockRequest,
  type TechnicianJobClockRequest,
} from "@/lib/field-operations/technician-job-clock";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const actor = await authorizeFieldRequest(request.headers);
  if (!actor) {
    return NextResponse.json({ error: "Field Pass required" }, { status: 401 });
  }

  try {
    const submitted = (await request.json()) as TechnicianJobClockRequest;
    const validationError = validateTechnicianJobClockRequest(submitted);
    if (validationError) throw new Error(validationError);
    await assertFieldActorCanWriteAppointment(
      actor,
      submitted.propertyId,
      submitted.appointmentId,
    );
    const result = await recordTechnicianJobClockAction({
      request: submitted,
      actor,
    });
    return NextResponse.json(result, {
      status: result.replayed ? 200 : 201,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update the job clock.";
    const forbidden =
      /not assigned|not available to this Field Pass|outside the safe|no longer active/i.test(
        message,
      );
    const conflict = /start the job clock before finishing/i.test(message);
    const invalid =
      /valid|not found|does not belong|not a verified Jobber stop/i.test(message);
    const status = forbidden ? 403 : conflict ? 409 : invalid ? 400 : 503;
    return NextResponse.json(
      { error: message },
      { status, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
