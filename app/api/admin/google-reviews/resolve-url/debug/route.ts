import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/pin";
import { runPlacesSearchDiagnostic } from "@/lib/reviews/places-search-debug";
import { diagnoseGoogleBusinessLink } from "@/lib/reviews/resolve-url-debug";
import { resolveSearchApiKey } from "@/lib/reviews/resolve-search-api-key";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(request: Request) {
  const pinHeader = request.headers.get("x-admin-pin");
  if (!authorizeAdminRequest(pinHeader)) return unauthorized();

  const body = (await request.json()) as {
    url?: string;
    apiKey?: string;
    phone?: string;
    website?: string;
    query?: string;
    pendingOnly?: boolean;
  };

  const url = body.url?.trim() ?? "";
  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  const keyInfo = resolveSearchApiKey(body.apiKey);
  const resolveDiagnostic = await diagnoseGoogleBusinessLink(url, keyInfo.apiKey, {
    phone: body.phone,
    website: body.website,
  });

  let searchDiagnostic = null;
  if (!resolveDiagnostic.placeId) {
    searchDiagnostic = await runPlacesSearchDiagnostic(
      keyInfo.apiKey,
      {
        name: body.query ?? resolveDiagnostic.businessNameHint ?? "SqueegeeKing",
        phone: body.phone,
        website: body.website,
        serviceAreaMode: true,
      },
      {
        apiKeySource: keyInfo.source,
        serverEnvKeyPresent: keyInfo.serverEnvKeyPresent,
        wizardKeyPresent: keyInfo.wizardKeyPresent,
      },
    );
  }

  return NextResponse.json({
    pendingOnly: Boolean(body.pendingOnly),
    resolveDiagnostic,
    searchDiagnostic,
    serverEnvKeyPresent: keyInfo.serverEnvKeyPresent,
    apiKeySource: keyInfo.source,
    placeId: resolveDiagnostic.placeId,
    found: Boolean(resolveDiagnostic.placeId),
    candidates:
      searchDiagnostic?.mergedCandidates ??
      resolveDiagnostic.searchCandidates ??
      [],
  });
}
