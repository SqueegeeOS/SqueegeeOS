import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import {
  issueSalesRepPhonePass,
  listSalesRepAccessRoster,
  revokeSalesRepPhonePass,
} from "@/lib/sales/sales-access";
import { salesWorkspacePath } from "@/lib/sales/sales-access-paths";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json(
    { error: "Unauthorized" },
    { status: 401, headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function GET(request: Request) {
  if (!authorizeAdminRequest(request.headers)) return unauthorized();
  try {
    return NextResponse.json(await listSalesRepAccessRoster(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load sales phone access.",
      },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}

export async function POST(request: Request) {
  if (!authorizeAdminRequest(request.headers)) return unauthorized();
  try {
    const body = (await request.json()) as { repSlug?: string };
    const issued = await issueSalesRepPhonePass({
      repSlug: body.repSlug ?? "",
    });
    const returnTo = salesWorkspacePath(issued.repSlug);
    return NextResponse.json(
      {
        grantId: issued.grantId,
        repSlug: issued.repSlug,
        displayName: issued.displayName,
        inviteExpiresAt: issued.inviteExpiresAt,
        claimPath: `/sales/access?token=${encodeURIComponent(issued.inviteToken)}&rep=${encodeURIComponent(issued.repSlug)}&returnTo=${encodeURIComponent(returnTo)}`,
      },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not create the phone pass.",
      },
      { status: 400, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}

export async function DELETE(request: Request) {
  if (!authorizeAdminRequest(request.headers)) return unauthorized();
  try {
    const body = (await request.json()) as { grantId?: string };
    const revoked = await revokeSalesRepPhonePass(body.grantId ?? "");
    return NextResponse.json(revoked, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not revoke the phone pass.",
      },
      { status: 400, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
