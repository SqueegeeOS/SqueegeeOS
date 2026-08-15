import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import {
  issueTechnicianFieldPass,
  listTechnicianAccessRoster,
  revokeTechnicianFieldPass,
} from "@/lib/field-operations/field-access";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: Request) {
  if (!authorizeAdminRequest(request.headers)) return unauthorized();
  try {
    return NextResponse.json(await listTechnicianAccessRoster(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load technician access.",
      },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}

export async function POST(request: Request) {
  if (!authorizeAdminRequest(request.headers)) return unauthorized();
  try {
    const body = (await request.json()) as {
      jobberUserId?: string;
      displayName?: string;
    };
    const issued = await issueTechnicianFieldPass({
      jobberUserId: body.jobberUserId ?? "",
      displayName: body.displayName ?? "",
    });
    return NextResponse.json(
      {
        grantId: issued.grantId,
        inviteExpiresAt: issued.inviteExpiresAt,
        claimPath: `/tech/access?token=${encodeURIComponent(issued.inviteToken)}`,
      },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not create Field Pass.",
      },
      { status: 400, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}

export async function DELETE(request: Request) {
  if (!authorizeAdminRequest(request.headers)) return unauthorized();
  try {
    const body = (await request.json()) as { grantId?: string };
    const revoked = await revokeTechnicianFieldPass(body.grantId ?? "");
    return NextResponse.json(revoked, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not revoke Field Pass.",
      },
      { status: 400, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
