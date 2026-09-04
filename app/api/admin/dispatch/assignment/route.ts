import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import {
  assignOwnerDispatchVisit,
  OwnerDispatchAssignmentError,
} from "@/lib/field-operations/owner-dispatch-assignment-server";
import { assignHomeAtlasTechnicianVisit } from "@/lib/field-operations/homeatlas-field-assignment-server";

export const runtime = "nodejs";

const STATUS_BY_CODE = {
  invalid_request: 400,
  not_found: 404,
  not_future: 409,
  conflict: 409,
  permission_required: 409,
  provider_rejected: 422,
  provider_unavailable: 503,
  verification_failed: 502,
} as const;

export async function POST(request: Request) {
  if (!authorizeAdminRequest(request.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = (await request.json()) as {
      projectionId?: string;
      jobberUserId?: string;
      expectedAssignedUserIds?: string[];
      expectedHomeAtlasTechnicianId?: string | null;
      clientRequestId?: string;
    };
    if (body.jobberUserId?.startsWith("homeatlas:")) {
      return NextResponse.json(
        await assignHomeAtlasTechnicianVisit({
          projectionId: body.projectionId ?? "",
          technicianIdentityKey: body.jobberUserId,
          expectedTechnicianIdentityKey:
            body.expectedHomeAtlasTechnicianId ?? null,
          clientRequestId: body.clientRequestId ?? "",
        }),
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    return NextResponse.json(
      await assignOwnerDispatchVisit({
        projectionId: body.projectionId ?? "",
        jobberUserId: body.jobberUserId ?? "",
        expectedAssignedUserIds: Array.isArray(body.expectedAssignedUserIds)
          ? body.expectedAssignedUserIds
          : [],
        clientRequestId: body.clientRequestId ?? "",
      }),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    const known = error instanceof OwnerDispatchAssignmentError;
    console.error("[owner-dispatch] assignment stopped", {
      code: known ? error.code : "internal_error",
      message: error instanceof Error ? error.message : "unknown",
    });
    const message = error instanceof Error ? error.message : "unknown";
    const homeAtlasConflict = /changed this visit after Dispatch loaded/i.test(message);
    const homeAtlasInvalid = /valid future visit|active HomeAtlas technician/i.test(message);
    return NextResponse.json(
      {
        error: known
          ? error.message
          : message === "unknown"
            ? "HomeAtlas could not finish that technician assignment."
            : message,
        code: known
          ? error.code
          : homeAtlasConflict
            ? "conflict"
            : homeAtlasInvalid
              ? "invalid_request"
              : "internal_error",
      },
      {
        status: known
          ? STATUS_BY_CODE[error.code]
          : homeAtlasConflict
            ? 409
            : homeAtlasInvalid
              ? 400
              : 500,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
}
