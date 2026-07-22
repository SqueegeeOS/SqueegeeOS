import { NextResponse } from "next/server";
import { authorizeHqApiRequest } from "@/lib/auth/hq-route-authorization";
import { HQ_AUTH_RESPONSE_HEADERS } from "@/lib/auth/hq-response-headers";
import { readJobberCoverageSyncStatus } from "@/lib/care-operations/jobber-coverage-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const authorization = await authorizeHqApiRequest();
  if (authorization.response) return authorization.response;

  try {
    return NextResponse.json(await readJobberCoverageSyncStatus(), {
      headers: HQ_AUTH_RESPONSE_HEADERS,
    });
  } catch {
    return NextResponse.json(
      { error: "Jobber schedule coverage status is unavailable" },
      { status: 503, headers: HQ_AUTH_RESPONSE_HEADERS },
    );
  }
}
