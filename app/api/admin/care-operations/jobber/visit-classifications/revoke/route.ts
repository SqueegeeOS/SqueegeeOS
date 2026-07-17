import { NextResponse } from "next/server";
import { authorizeHqApiRequest } from "@/lib/auth/hq-route-authorization";
import {
  revokeJobberVisitClassification,
  VisitClassificationError,
} from "@/lib/care-operations/jobber-visit-classification";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authorization = await authorizeHqApiRequest();
  if (authorization.response) return authorization.response;
  let body: {
    classificationId?: string;
    expectedUpdatedAt?: string;
    reason?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.classificationId || !body.expectedUpdatedAt || !body.reason) {
    return NextResponse.json(
      { error: "Refresh the classification and provide a revocation reason." },
      { status: 400 },
    );
  }
  try {
    const outcome = await revokeJobberVisitClassification({
      classificationId: body.classificationId,
      expectedUpdatedAt: body.expectedUpdatedAt,
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
      { error: "The visit classification was not revoked." },
      { status: 503 },
    );
  }
}
