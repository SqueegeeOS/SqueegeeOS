import { NextRequest, NextResponse } from "next/server";
import {
  listPresentations,
} from "@/lib/presentations/repository";
import { authorizeHqApiRequest } from "@/lib/auth/hq-route-authorization";
import { readLimitedJsonObject } from "@/lib/http/read-limited-json-object";
import { parseCreatePresentationAuthorityInput } from "@/lib/presentations/authority-input";
import {
  createAuthorizedPresentation,
  PresentationAuthoringError,
} from "@/lib/presentations/server-authoring";

const PRESENTATION_BODY_LIMIT_BYTES = 256 * 1024;

export async function GET() {
  const authorization = await authorizeHqApiRequest();
  if (authorization.response) return authorization.response;

  try {
    const presentations = await listPresentations();
    return NextResponse.json({ presentations });
  } catch (error) {
    console.error("[presentations] list error:", error);
    return NextResponse.json(
      { error: "Failed to list presentations" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const authorization = await authorizeHqApiRequest();
  if (authorization.response) return authorization.response;

  try {
    const body = await readLimitedJsonObject(
      req,
      PRESENTATION_BODY_LIMIT_BYTES,
    );
    if (!body) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const input = parseCreatePresentationAuthorityInput(body);
    if (!input) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const presentation = await createAuthorizedPresentation(
      input,
      authorization.actor,
    );
    return NextResponse.json({ presentation }, { status: 201 });
  } catch (error) {
    if (error instanceof PresentationAuthoringError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[presentations] create error:", error);
    return NextResponse.json(
      { error: "Failed to create presentation" },
      { status: 500 },
    );
  }
}
