import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/pin";
import { runPlacesSearchDiagnostic } from "@/lib/reviews/places-search-debug";
import type { BusinessSearchInput } from "@/lib/reviews/place-id-resolver";
import { resolveSearchApiKey } from "@/lib/reviews/resolve-search-api-key";
import { searchGooglePlacesMulti } from "@/lib/reviews/place-id-resolver";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(request: Request) {
  const pinHeader = request.headers.get("x-admin-pin");
  if (!authorizeAdminRequest(pinHeader)) return unauthorized();

  const body = (await request.json()) as {
    apiKey?: string;
    query?: string;
    phone?: string;
    website?: string;
    serviceAreaMode?: boolean;
    diagnostic?: boolean;
  };

  const keyInfo = resolveSearchApiKey(body.apiKey);
  const input: BusinessSearchInput = {
    name: body.query ?? "",
    phone: body.phone,
    website: body.website,
    serviceAreaMode: body.serviceAreaMode,
  };

  if (body.diagnostic !== false) {
    const diagnostic = await runPlacesSearchDiagnostic(keyInfo.apiKey, input, {
      apiKeySource: keyInfo.source,
      serverEnvKeyPresent: keyInfo.serverEnvKeyPresent,
      wizardKeyPresent: keyInfo.wizardKeyPresent,
    });

    return NextResponse.json({
      results: diagnostic.mergedCandidates.map((candidate) => ({
        placeId: candidate.placeId,
        name: candidate.name,
        locationLabel: candidate.locationLabel ?? "",
        isServiceAreaBusiness: candidate.isServiceAreaBusiness ?? false,
        rating: candidate.rating,
        reviewCount: candidate.reviewCount,
        website: candidate.website,
        phone: candidate.phone,
      })),
      diagnostic,
    });
  }

  const results = await searchGooglePlacesMulti(keyInfo.apiKey, input);

  return NextResponse.json({
    results,
    diagnostic: {
      apiKeySource: keyInfo.source,
      serverEnvKeyPresent: keyInfo.serverEnvKeyPresent,
      wizardKeyPresent: keyInfo.wizardKeyPresent,
    },
  });
}
