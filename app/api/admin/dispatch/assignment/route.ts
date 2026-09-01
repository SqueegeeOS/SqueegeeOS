import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import {
  assignOwnerDispatchVisit,
  OwnerDispatchAssignmentError,
} from "@/lib/field-operations/owner-dispatch-assignment-server";

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
      clientRequestId?: string;
    };
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
    return NextResponse.json(
      {
        error: known
          ? error.message
          : "HomeAtlas could not finish that Jobber assignment.",
        code: known ? error.code : "internal_error",
      },
      {
        status: known ? STATUS_BY_CODE[error.code] : 500,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
}
