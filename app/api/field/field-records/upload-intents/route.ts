import { NextResponse } from "next/server";
import { authorizeFieldRequest } from "@/lib/field-operations/field-access";
import { assertFieldActorCanWriteAppointment } from "@/lib/field-operations/field-scope";
import { createVisitPhotoUploadIntents } from "@/lib/field-records/visit-field-record-server";
import {
  validateVisitPhotoUploadRequest,
  type VisitPhotoUploadRequest,
} from "@/lib/field-records/visit-field-record";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const actor = await authorizeFieldRequest(request.headers);
  if (!actor) {
    return NextResponse.json({ error: "Field Pass required" }, { status: 401 });
  }

  try {
    const input = (await request.json()) as VisitPhotoUploadRequest;
    const validationError = validateVisitPhotoUploadRequest(input);
    if (validationError) throw new Error(validationError);
    await assertFieldActorCanWriteAppointment(
      actor,
      input.propertyId,
      input.appointmentId,
    );
    const result = await createVisitPhotoUploadIntents(input);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not prepare photo upload.";
    const forbidden = /not assigned|not available to this Field Pass|outside the safe/i.test(
      message,
    );
    const status = forbidden
      ? 403
      : /not found|does not belong|valid|Choose|photo|Refresh/i.test(message)
        ? 400
        : 503;
    return NextResponse.json(
      { error: message },
      { status, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
