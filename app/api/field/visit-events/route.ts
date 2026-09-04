import { NextResponse } from "next/server";
import { authorizeFieldRequest } from "@/lib/field-operations/field-access";
import { assertFieldActorCanWriteAppointment } from "@/lib/field-operations/field-scope";
import { recordTechnicianVisitEvent } from "@/lib/field-operations/technician-visit-event-server";
import { assertTechnicianCanFinishJob } from "@/lib/field-operations/technician-job-clock-server";
import {
  validateTechnicianVisitEventRequest,
  type TechnicianVisitEventRequest,
} from "@/lib/field-operations/technician-visit-events";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const actor = await authorizeFieldRequest(request.headers);
  if (!actor) {
    return NextResponse.json({ error: "Field Pass required" }, { status: 401 });
  }

  try {
    const submitted = (await request.json()) as TechnicianVisitEventRequest;
    const validationError = validateTechnicianVisitEventRequest(submitted);
    if (validationError) throw new Error(validationError);
    await assertFieldActorCanWriteAppointment(
      actor,
      submitted.propertyId,
      submitted.appointmentId,
    );
    if (actor.kind === "technician" && submitted.eventType === "departed") {
      await assertTechnicianCanFinishJob(submitted.appointmentId);
    }
    const event = await recordTechnicianVisitEvent({
      request: submitted,
      actor,
      source: "field_action",
    });
    return NextResponse.json(event, {
      status: event.replayed ? 200 : 201,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not advance the field route.";
    const forbidden =
      /not assigned|not available to this Field Pass|outside the safe|no longer active/i.test(
        message,
      );
    const conflict =
      /cannot move backwards|prior technician route stage|closeout before completing/i.test(
        message,
      );
    const invalid =
      /valid|not found|does not belong|not a verified Jobber stop/i.test(message);
    const status = forbidden ? 403 : conflict ? 409 : invalid ? 400 : 503;
    return NextResponse.json(
      { error: message },
      { status, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
