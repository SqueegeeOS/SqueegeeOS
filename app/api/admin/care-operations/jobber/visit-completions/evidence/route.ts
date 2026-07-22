import { NextResponse } from "next/server";
import { authorizeHqApiRequest } from "@/lib/auth/hq-route-authorization";
import {
  appendVisitTextEvidence,
  VisitCompletionError,
} from "@/lib/care-operations/jobber-visit-completion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };

export async function POST(request: Request) {
  const authorization = await authorizeHqApiRequest();
  if (authorization.response) return authorization.response;

  let body: {
    evidenceId?: string;
    appointmentId?: string;
    evidenceText?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }
  if (!body.evidenceId || !body.appointmentId || !body.evidenceText) {
    return NextResponse.json(
      { error: "Provide text evidence for the exact completed appointment." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const outcome = await appendVisitTextEvidence({
      evidenceId: body.evidenceId,
      appointmentId: body.appointmentId,
      evidenceText: body.evidenceText,
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
      { error: "The visit evidence was not recorded." },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
}
