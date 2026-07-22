import { NextResponse } from "next/server";
import { authorizeHqApiRequest } from "@/lib/auth/hq-route-authorization";
import { listJobberVisitSample } from "@/lib/care-operations/jobber-visit-sample";

export const runtime = "nodejs";

export async function GET() {
  const authorization = await authorizeHqApiRequest();
  if (authorization.response) return authorization.response;
  try {
    return NextResponse.json({
      executionMode: "read_only",
      automaticMatching: false,
      visits: await listJobberVisitSample(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sample load failed";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function POST() {
  const authorization = await authorizeHqApiRequest();
  if (authorization.response) return authorization.response;
  return NextResponse.json(
    {
      error:
        "The sample import is retired. Use the coverage-proven Jobber schedule refresh.",
    },
    { status: 410 },
  );
}
