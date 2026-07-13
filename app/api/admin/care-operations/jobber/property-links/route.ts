import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/pin";
import {
  linkJobberProperty,
  loadJobberPropertyMatchingWorkspace,
  revokeJobberPropertyLink,
  SupervisedPropertyMatchError,
} from "@/lib/care-operations/jobber-property-matching";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: Request) {
  if (!authorizeAdminRequest(request.headers.get("x-admin-pin"))) {
    return unauthorized();
  }
  try {
    return NextResponse.json(await loadJobberPropertyMatchingWorkspace());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Property workspace failed";
    console.error("[jobber-property-links] load failed:", message);
    return NextResponse.json(
      { error: "Could not load supervised property matching." },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  if (!authorizeAdminRequest(request.headers.get("x-admin-pin"))) {
    return unauthorized();
  }
  let body: {
    action?: "link" | "revoke";
    projectionId?: string;
    membershipId?: string;
    samePhysicalPropertyConfirmed?: boolean;
    expectedLinkUpdatedAt?: string | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    if (body.action === "link") {
      if (!body.projectionId || !body.membershipId) {
        throw new SupervisedPropertyMatchError(
          "Select a Jobber visit and an active HomeAtlas member property.",
          400,
        );
      }
      const outcome = await linkJobberProperty({
        projectionId: body.projectionId,
        membershipId: body.membershipId,
        samePhysicalPropertyConfirmed:
          body.samePhysicalPropertyConfirmed === true,
        expectedLinkUpdatedAt: body.expectedLinkUpdatedAt,
      });
      return NextResponse.json({
        outcome,
        workspace: await loadJobberPropertyMatchingWorkspace(),
      });
    }

    if (body.action === "revoke") {
      if (!body.projectionId || !body.expectedLinkUpdatedAt) {
        throw new SupervisedPropertyMatchError(
          "Refresh the property link before revoking it.",
          400,
        );
      }
      const outcome = await revokeJobberPropertyLink({
        projectionId: body.projectionId,
        expectedLinkUpdatedAt: body.expectedLinkUpdatedAt,
      });
      return NextResponse.json({
        outcome,
        workspace: await loadJobberPropertyMatchingWorkspace(),
      });
    }

    return NextResponse.json(
      { error: "Choose link or revoke." },
      { status: 400 },
    );
  } catch (error) {
    if (error instanceof SupervisedPropertyMatchError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    const message = error instanceof Error ? error.message : "Write failed";
    console.error("[jobber-property-links] supervised write failed:", message);
    return NextResponse.json(
      {
        error:
          "The property link was not changed. Refresh and verify both properties before trying again.",
      },
      { status: 503 },
    );
  }
}
