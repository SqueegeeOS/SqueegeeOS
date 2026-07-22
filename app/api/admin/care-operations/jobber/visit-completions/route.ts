import { NextResponse } from "next/server";
import { authorizeHqApiRequest } from "@/lib/auth/hq-route-authorization";
import {
  confirmJobberVisitCompletion,
  VisitCompletionError,
} from "@/lib/care-operations/jobber-visit-completion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };

export async function POST(request: Request) {
  const authorization = await authorizeHqApiRequest();
  if (authorization.response) return authorization.response;

  let body: {
    appointmentId?: string;
    projectionId?: string;
    sourcePayloadHash?: string;
    classificationId?: string;
    classificationUpdatedAt?: string;
    propertyLinkUpdatedAt?: string;
    reason?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }
  if (
    !body.appointmentId ||
    !body.projectionId ||
    !body.sourcePayloadHash ||
    !body.classificationId ||
    !body.classificationUpdatedAt ||
    !body.propertyLinkUpdatedAt ||
    !body.reason
  ) {
    return NextResponse.json(
      { error: "Refresh the exact visit and provide a confirmation reason." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const outcome = await confirmJobberVisitCompletion({
      appointmentId: body.appointmentId,
      projectionId: body.projectionId,
      sourcePayloadHash: body.sourcePayloadHash,
      classificationId: body.classificationId,
      classificationUpdatedAt: body.classificationUpdatedAt,
      propertyLinkUpdatedAt: body.propertyLinkUpdatedAt,
      reason: body.reason,
      actorId: authorization.actor.id,
    });
    return NextResponse.json({ outcome }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof VisitCompletionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: NO_STORE_HEADERS },
      );
    }
    return NextResponse.json(
      { error: "The visit completion was not confirmed." },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
}
