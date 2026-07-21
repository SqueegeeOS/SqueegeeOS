import { NextResponse } from "next/server";
import { authorizeHqApiRequest } from "@/lib/auth/hq-route-authorization";
import {
  importJobberVisitSample,
  listJobberVisitSample,
} from "@/lib/care-operations/jobber-visit-sample";

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

export async function POST(request: Request) {
  const authorization = await authorizeHqApiRequest();
  if (authorization.response) return authorization.response;
  let limit = 5;
  try {
    const body = (await request.json()) as { limit?: number };
    if (body.limit !== undefined) limit = body.limit;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) {
    return NextResponse.json(
      { error: "Sample limit must be an integer from 1 through 10." },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(await importJobberVisitSample(limit));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sample import failed";
    console.error("[jobber-sample] import failed:", message);
    return NextResponse.json(
      { error: "Jobber sample import failed. No Jobber data was changed." },
      { status: 502 },
    );
  }
}
