import { NextResponse } from "next/server";
import { authorizeHqApiRequest } from "@/lib/auth/hq-route-authorization";
import {
  decideJobberVisitClassification,
  loadJobberVisitClassificationWorkspace,
  VisitClassificationError,
} from "@/lib/care-operations/jobber-visit-classification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET() {
  const authorization = await authorizeHqApiRequest();
  if (authorization.response) return authorization.response;
  try {
    return NextResponse.json(
      await loadJobberVisitClassificationWorkspace(),
      { headers: NO_STORE_HEADERS },
    );
  } catch {
    return NextResponse.json(
      { error: "Jobber visit review is unavailable." },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeHqApiRequest();
  if (authorization.response) return authorization.response;
  let body: {
    action?: "approve" | "reject";
    projectionId?: string;
    sourcePayloadHash?: string;
    propertyLinkId?: string;
    propertyLinkUpdatedAt?: string;
    membershipId?: string;
    propertyId?: string;
    serviceType?: string;
    reason?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (
    (body.action !== "approve" && body.action !== "reject") ||
    !body.projectionId ||
    !body.sourcePayloadHash ||
    !body.propertyLinkId ||
    !body.propertyLinkUpdatedAt ||
    !body.membershipId ||
    !body.propertyId ||
    !body.serviceType ||
    !body.reason
  ) {
    return NextResponse.json(
      { error: "Every reviewed visit-classification field is required." },
      { status: 400 },
    );
  }

  try {
    const outcome = await decideJobberVisitClassification({
      action: body.action,
      projectionId: body.projectionId,
      sourcePayloadHash: body.sourcePayloadHash,
      propertyLinkId: body.propertyLinkId,
      propertyLinkUpdatedAt: body.propertyLinkUpdatedAt,
      membershipId: body.membershipId,
      propertyId: body.propertyId,
      serviceType: body.serviceType,
      reason: body.reason,
      actorId: authorization.actor.id,
    });
    return NextResponse.json({ outcome });
  } catch (error) {
    if (error instanceof VisitClassificationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: "The visit decision was not recorded." },
      { status: 503 },
    );
  }
}
