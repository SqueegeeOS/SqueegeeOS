import { NextResponse } from "next/server";
import { authorizeHqApiRequest } from "@/lib/auth/hq-route-authorization";
import { HQ_AUTH_RESPONSE_HEADERS } from "@/lib/auth/hq-response-headers";
import {
  JobberClientProviderError,
  listJobberClientPropertiesPage,
} from "@/lib/care-operations/jobber-client-search-provider";
import { getFreshJobberAccessToken } from "@/lib/care-operations/jobber-connection-store";
import { loadActiveMemberPropertyCandidates } from "@/lib/care-operations/jobber-property-matching";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function providerErrorResponse(error: JobberClientProviderError) {
  const status =
    error.code === "invalid_client_id" || error.code === "invalid_cursor"
      ? 400
      : error.code === "client_not_found"
        ? 404
        : error.code === "http_429"
          ? 429
          : 502;
  const message =
    error.code === "invalid_client_id"
      ? "Select a valid Jobber customer."
      : error.code === "invalid_cursor"
        ? "Refresh this Jobber customer's properties before continuing."
      : error.code === "client_not_found"
        ? "That Jobber customer could not be found."
        : error.code === "http_429"
          ? "Jobber is limiting requests. Wait a moment and try again."
          : "Jobber properties are temporarily unavailable.";
  console.error("[jobber-client-properties] provider failure", {
    code: error.code,
  });
  return NextResponse.json(
    { error: message },
    { status, headers: HQ_AUTH_RESPONSE_HEADERS },
  );
}

export async function POST(request: Request) {
  const authorization = await authorizeHqApiRequest();
  if (authorization.response) return authorization.response;

  let body: unknown;
  try {
    body = (await request.json()) as unknown;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: HQ_AUTH_RESPONSE_HEADERS },
    );
  }
  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) ||
    typeof (body as { clientId?: unknown }).clientId !== "string" ||
    ((body as { after?: unknown }).after !== undefined &&
      (body as { after?: unknown }).after !== null &&
      typeof (body as { after?: unknown }).after !== "string")
  ) {
    return NextResponse.json(
      { error: "Select a Jobber customer." },
      { status: 400, headers: HQ_AUTH_RESPONSE_HEADERS },
    );
  }

  try {
    const accessToken = await getFreshJobberAccessToken();
    const clientId = (body as { clientId: string }).clientId;
    const [jobber, homeAtlas] = await Promise.all([
      listJobberClientPropertiesPage(accessToken, clientId, {
        after: (body as { after?: string | null }).after ?? null,
      }),
      loadActiveMemberPropertyCandidates(),
    ]);
    return NextResponse.json(
      { ...jobber, ...homeAtlas },
      { headers: HQ_AUTH_RESPONSE_HEADERS },
    );
  } catch (error) {
    if (error instanceof JobberClientProviderError) {
      return providerErrorResponse(error);
    }
    console.error("[jobber-client-properties] unavailable");
    return NextResponse.json(
      { error: "Jobber properties are temporarily unavailable." },
      { status: 503, headers: HQ_AUTH_RESPONSE_HEADERS },
    );
  }
}
