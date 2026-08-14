import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import { createVisitPhotoUploadIntents } from "@/lib/field-records/visit-field-record-server";
import type { VisitPhotoUploadRequest } from "@/lib/field-records/visit-field-record";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!authorizeAdminRequest(request.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const input = (await request.json()) as VisitPhotoUploadRequest;
    const result = await createVisitPhotoUploadIntents(input);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not prepare photo upload.";
    const status = /not found|does not belong|valid|Choose|photo/i.test(message)
      ? 400
      : 503;
    return NextResponse.json(
      { error: message },
      { status, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
