import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import { resolveGoogleBusinessLink } from "@/lib/reviews/place-id-resolver";
import { resolveSearchApiKey } from "@/lib/reviews/resolve-search-api-key";
import { logGoogleReviewsSetup } from "@/lib/reviews/setup-log";

export async function POST(request: Request) {
  const authHeaders = request.headers;
  if (!authorizeAdminRequest(authHeaders)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    url?: string;
    apiKey?: string;
    phone?: string;
    website?: string;
  };
  const url = body.url?.trim() ?? "";
  const keyInfo = resolveSearchApiKey(body.apiKey);

  if (!url) {
    return NextResponse.json(
      { error: "Paste a Google Maps or Google Business link." },
      { status: 400 },
    );
  }

  const result = await resolveGoogleBusinessLink(url, keyInfo.apiKey, {
    phone: body.phone,
    website: body.website,
  });

  if (result.placeId) {
    logGoogleReviewsSetup("place_resolved", {
      source: "resolve_url",
      method: result.method,
      placeId: result.placeId,
      candidateCount: result.candidates.length,
    });
  }

  return NextResponse.json({
    placeId: result.placeId,
    resolvedUrl: result.resolvedUrl,
    businessNameHint: result.businessNameHint,
    candidates: result.candidates,
    method: result.method,
    found: Boolean(result.placeId),
    needsSelection: !result.placeId && result.candidates.length > 0,
    serverEnvKeyPresent: keyInfo.serverEnvKeyPresent,
    apiKeySource: keyInfo.source,
  });
}
