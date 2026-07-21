import { NextResponse } from "next/server";
import { authorizeHqApiRequest } from "@/lib/auth/hq-route-authorization";
import { HQ_AUTH_RESPONSE_HEADERS } from "@/lib/auth/hq-response-headers";
import { jobberCoveragePersistence } from "@/lib/care-operations/jobber-coverage-store";
import { runJobberCoverageSync } from "@/lib/care-operations/jobber-coverage-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Next emits this deployment hint; release verification must prove the target
// platform honors the full envelope before enabling the manual action.
export const maxDuration = 300;

export async function POST() {
  const authorization = await authorizeHqApiRequest();
  if (authorization.response) return authorization.response;

  const result = await runJobberCoverageSync(
    authorization.actor,
    jobberCoveragePersistence,
  );
  if (result.outcome === "concurrent") {
    return NextResponse.json(result, {
      status: 409,
      headers: HQ_AUTH_RESPONSE_HEADERS,
    });
  }
  if (result.outcome === "indeterminate") {
    console.error("[jobber-coverage-sync] indeterminate finalization", {
      runId: result.runId,
    });
    return NextResponse.json(result, {
      status: 202,
      headers: HQ_AUTH_RESPONSE_HEADERS,
    });
  }
  if (result.outcome === "awaiting_continuation") {
    return NextResponse.json(result, {
      status: 202,
      headers: HQ_AUTH_RESPONSE_HEADERS,
    });
  }
  if (result.outcome === "partial") {
    console.error("[jobber-coverage-sync] partial run", {
      runId: result.runId,
      failureCode: result.failureCode,
    });
    return NextResponse.json(result, {
      status: 502,
      headers: HQ_AUTH_RESPONSE_HEADERS,
    });
  }
  return NextResponse.json(result, { headers: HQ_AUTH_RESPONSE_HEADERS });
}
