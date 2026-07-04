import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/pin";
import { resolveGoogleBusinessLink } from "@/lib/reviews/place-id-resolver";
import { resolveSearchApiKey } from "@/lib/reviews/resolve-search-api-key";
import { logGoogleReviewsSetup } from "@/lib/reviews/setup-log";

export async function POST(request: Request) {
  const pinHeader = request.headers.get("x-admin-pin");
  if (!authorizeAdminRequest(pinHeader)) {
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

  const resolvedName =
    result.candidates.find((item) => item.placeId === result.placeId)?.name ??
    result.businessNameHint ??
    result.candidates[0]?.name ??
    null;

  if (result.placeId) {
    logGoogleReviewsSetup("place_resolved", {
      source: "resolve_url",
      inputUrl: url,
      resolvedUrl: result.resolvedUrl,
      method: result.method,
      placeId: result.placeId,
      businessName: resolvedName,
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
