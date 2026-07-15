import { NextRequest, NextResponse } from "next/server";
import {
  getPresentationByCapability,
  markPresentationPresentedByCapability,
} from "@/lib/presentations/repository";
import { authorizeHqApiRequest } from "@/lib/auth/hq-route-authorization";
import { readLimitedJsonObject } from "@/lib/http/read-limited-json-object";
import { parsePatchPresentationAuthorityInput } from "@/lib/presentations/authority-input";
import {
  patchAuthorizedPresentation,
  PresentationAuthoringError,
} from "@/lib/presentations/server-authoring";

const PRESENTATION_BODY_LIMIT_BYTES = 256 * 1024;

function isPublicPresentedTransition(
  body: Record<string, unknown>,
): body is { status: "presented" } {
  return Object.keys(body).length === 1 && body.status === "presented";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const presentation = await getPresentationByCapability(id);
    if (!presentation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ presentation });
  } catch (error) {
    console.error("[presentations] get error:", error);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await readLimitedJsonObject(
      req,
      PRESENTATION_BODY_LIMIT_BYTES,
    );
    if (!body) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    if (isPublicPresentedTransition(body)) {
      const presentation = await markPresentationPresentedByCapability(id);
      if (!presentation) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json({ presentation });
    }

    const authorization = await authorizeHqApiRequest();
    if (authorization.response) return authorization.response;

    const patch = parsePatchPresentationAuthorityInput(body);
    if (!patch) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const presentation = await patchAuthorizedPresentation(id, patch);
    if (!presentation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ presentation });
  } catch (error) {
    if (error instanceof PresentationAuthoringError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[presentations] patch error:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
