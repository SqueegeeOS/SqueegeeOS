import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import {
  linkJobberProperty,
  linkJobberMembershipJob,
  loadJobberPropertyMatchingWorkspace,
  revokeJobberPropertyLink,
  revokeJobberMembershipJob,
  SupervisedPropertyMatchError,
} from "@/lib/care-operations/jobber-property-matching";

export const runtime = "nodejs";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

function unauthorized() {
  return json({ error: "Unauthorized" }, 401);
}

function listOptions(url: URL) {
  return {
    search: url.searchParams.get("search") ?? "",
    page: Number.parseInt(url.searchParams.get("page") ?? "1", 10),
    pageSize: Number.parseInt(url.searchParams.get("pageSize") ?? "25", 10),
    focusMembershipId: url.searchParams.get("membershipId"),
  };
}

export async function GET(request: Request) {
  if (!authorizeAdminRequest(request.headers)) {
    return unauthorized();
  }
  try {
    return json(
      await loadJobberPropertyMatchingWorkspace(listOptions(new URL(request.url))),
    );
  } catch (error) {
    if (error instanceof SupervisedPropertyMatchError) {
      return json({ error: error.message }, error.status);
    }
    const message =
      error instanceof Error ? error.message : "Property workspace failed";
    console.error("[jobber-property-links] load failed:", message);
    return json({ error: "Could not load supervised property matching." }, 503);
  }
}

export async function POST(request: Request) {
  if (!authorizeAdminRequest(request.headers)) {
    return unauthorized();
  }
  let body: {
    action?: "link" | "revoke" | "link_job" | "revoke_job";
    projectionId?: string;
    membershipId?: string;
    samePhysicalPropertyConfirmed?: boolean;
    membershipServiceConfirmed?: boolean;
    expectedLinkUpdatedAt?: string | null;
    expectedJobLinkUpdatedAt?: string | null;
    focusMembershipId?: string | null;
    search?: string;
    page?: number;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
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
      return json({
        outcome,
        workspace: await loadJobberPropertyMatchingWorkspace({
          search: body.search,
          page: body.page,
          focusMembershipId: body.focusMembershipId,
        }),
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
      return json({
        outcome,
        workspace: await loadJobberPropertyMatchingWorkspace({
          search: body.search,
          page: body.page,
          focusMembershipId: body.focusMembershipId,
        }),
      });
    }

    if (body.action === "link_job") {
      if (!body.projectionId) {
        throw new SupervisedPropertyMatchError(
          "Select a Jobber visit before classifying its recurring job.",
          400,
        );
      }
      const outcome = await linkJobberMembershipJob({
        projectionId: body.projectionId,
        membershipServiceConfirmed:
          body.membershipServiceConfirmed === true,
        expectedJobLinkUpdatedAt: body.expectedJobLinkUpdatedAt,
      });
      return json({
        outcome,
        workspace: await loadJobberPropertyMatchingWorkspace({
          search: body.search,
          page: body.page,
          focusMembershipId: body.focusMembershipId,
        }),
      });
    }

    if (body.action === "revoke_job") {
      if (!body.projectionId || !body.expectedJobLinkUpdatedAt) {
        throw new SupervisedPropertyMatchError(
          "Refresh the membership job before removing its classification.",
          400,
        );
      }
      const outcome = await revokeJobberMembershipJob({
        projectionId: body.projectionId,
        expectedJobLinkUpdatedAt: body.expectedJobLinkUpdatedAt,
      });
      return json({
        outcome,
        workspace: await loadJobberPropertyMatchingWorkspace({
          search: body.search,
          page: body.page,
          focusMembershipId: body.focusMembershipId,
        }),
      });
    }

    return json({ error: "Choose a property or membership-job action." }, 400);
  } catch (error) {
    if (error instanceof SupervisedPropertyMatchError) {
      return json({ error: error.message }, error.status);
    }
    const message = error instanceof Error ? error.message : "Write failed";
    console.error("[jobber-property-links] supervised write failed:", message);
    const membershipJobAction =
      body.action === "link_job" || body.action === "revoke_job";
    return json(
      {
        error: membershipJobAction
          ? "The membership-job classification was not changed. Refresh and verify the exact recurring Jobber job before trying again."
          : "The property link was not changed. Refresh and verify both properties before trying again.",
      },
      503,
    );
  }
}
