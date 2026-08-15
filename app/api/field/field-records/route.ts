import { NextResponse } from "next/server";
import { authorizeFieldRequest } from "@/lib/field-operations/field-access";
import { assertFieldActorCanWriteAppointment } from "@/lib/field-operations/field-scope";
import { recordTechnicianVisitEvent } from "@/lib/field-operations/technician-visit-event-server";
import { commitVisitFieldRecord } from "@/lib/field-records/visit-field-record-server";
import {
  validateVisitFieldRecordCommit,
  type VisitFieldRecordCommitInput,
} from "@/lib/field-records/visit-field-record";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const actor = await authorizeFieldRequest(request.headers);
  if (!actor) {
    return NextResponse.json({ error: "Field Pass required" }, { status: 401 });
  }

  try {
    const submitted = (await request.json()) as VisitFieldRecordCommitInput;
    const input: VisitFieldRecordCommitInput =
      actor.kind === "technician"
        ? { ...submitted, technicianName: actor.displayName }
        : submitted;
    const validationError = validateVisitFieldRecordCommit(input);
    if (validationError) throw new Error(validationError);
    await assertFieldActorCanWriteAppointment(
      actor,
      input.propertyId,
      input.appointmentId,
    );
    const result = await commitVisitFieldRecord(input);
    let routeEventRecorded: boolean | null = null;
    let routeEventWarning: string | null = null;
    if (actor.kind === "technician") {
      try {
        await recordTechnicianVisitEvent({
          request: {
            eventId: input.fieldRecordId,
            propertyId: input.propertyId,
            appointmentId: input.appointmentId,
            eventType: "service_completed",
          },
          actor,
          source: "closeout",
        });
        routeEventRecorded = true;
      } catch (routeEventError) {
        routeEventRecorded = false;
        routeEventWarning =
          "Closeout saved, but route status needs a retry. Refresh and tap Mark service complete.";
        console.warn(
          "[field-records] closeout saved without route event:",
          routeEventError instanceof Error
            ? routeEventError.message
            : "unknown route event error",
        );
      }
    }
    return NextResponse.json(
      { ...result, routeEventRecorded, routeEventWarning },
      {
        status: 201,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not save the visit record.";
    const forbidden = /not assigned|not available to this Field Pass|outside the safe/i.test(
      message,
    );
    const status = forbidden
      ? 403
      : /not found|does not belong|valid|must|Add|photo|Enter|Refresh/i.test(
            message,
          )
        ? 400
        : 503;
    return NextResponse.json(
      { error: message },
      { status, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
