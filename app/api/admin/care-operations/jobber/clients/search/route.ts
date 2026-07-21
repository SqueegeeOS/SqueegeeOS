import { NextResponse } from "next/server";
import { authorizeHqApiRequest } from "@/lib/auth/hq-route-authorization";
import { HQ_AUTH_RESPONSE_HEADERS } from "@/lib/auth/hq-response-headers";
import {
  JobberClientProviderError,
  searchJobberClients,
} from "@/lib/care-operations/jobber-client-search-provider";
import { getFreshJobberAccessToken } from "@/lib/care-operations/jobber-connection-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function providerErrorResponse(error: JobberClientProviderError) {
  const status =
    error.code === "invalid_query" || error.code === "invalid_cursor"
      ? 400
      : error.code === "http_429"
        ? 429
        : 502;
  const message =
    error.code === "invalid_query"
      ? "Enter 2 to 100 search characters."
      : error.code === "invalid_cursor"
        ? "Refresh the Jobber customer search before continuing."
      : error.code === "http_429"
        ? "Jobber is limiting requests. Wait a moment and try again."
        : "Jobber customer search is temporarily unavailable.";
  console.error("[jobber-client-search] provider failure", {
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
    typeof (body as { query?: unknown }).query !== "string" ||
    ((body as { after?: unknown }).after !== undefined &&
      (body as { after?: unknown }).after !== null &&
      typeof (body as { after?: unknown }).after !== "string")
  ) {
    return NextResponse.json(
      { error: "Enter a customer name to search." },
      { status: 400, headers: HQ_AUTH_RESPONSE_HEADERS },
    );
  }

  try {
    const accessToken = await getFreshJobberAccessToken();
    return NextResponse.json(
      await searchJobberClients(
        accessToken,
        (body as { query: string }).query,
        { after: (body as { after?: string | null }).after ?? null },
      ),
      { headers: HQ_AUTH_RESPONSE_HEADERS },
    );
  } catch (error) {
    if (error instanceof JobberClientProviderError) {
      return providerErrorResponse(error);
    }
    console.error("[jobber-client-search] unavailable");
    return NextResponse.json(
      { error: "Jobber customer search is temporarily unavailable." },
      { status: 503, headers: HQ_AUTH_RESPONSE_HEADERS },
    );
  }
}
