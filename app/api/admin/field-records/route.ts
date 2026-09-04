import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import { recordTechnicianVisitEvent } from "@/lib/field-operations/technician-visit-event-server";
import { commitVisitFieldRecord } from "@/lib/field-records/visit-field-record-server";
import type { VisitFieldRecordCommitInput } from "@/lib/field-records/visit-field-record";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!authorizeAdminRequest(request.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const input = (await request.json()) as VisitFieldRecordCommitInput;
    const result = await commitVisitFieldRecord(input);
    let routeEventRecorded: boolean | null = null;
    let routeEventWarning: string | null = null;
    try {
      await recordTechnicianVisitEvent({
        request: {
          eventId: input.fieldRecordId,
          propertyId: input.propertyId!,
          appointmentId: input.appointmentId!,
          eventType: "service_completed",
        },
        actor: {
          kind: "admin",
          displayName: "HomeAtlas HQ",
          grantId: null,
          jobberUserId: null,
        },
        source: "closeout",
      });
      routeEventRecorded = true;
    } catch (routeEventError) {
      routeEventRecorded = false;
      routeEventWarning =
        "Closeout saved, but route status needs a retry. Refresh, advance any missing route steps, and save again.";
      console.warn(
        "[admin-field-records] closeout saved without route event:",
        routeEventError instanceof Error
          ? routeEventError.message
          : "unknown route event error",
      );
    }
    return NextResponse.json({ ...result, routeEventRecorded, routeEventWarning }, {
      status: 201,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not save the visit record.";
    const status = /not found|does not belong|valid|must|Add|photo|Enter/i.test(
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
