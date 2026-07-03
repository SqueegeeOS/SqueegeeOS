import {
  extractBusinessNameFromHtml,
  extractBusinessNameFromMapsUrl,
  extractPlaceIdFromText,
  followRedirectsToFinalUrlForDebug,
  isGoogleBusinessUrl,
  searchGooglePlacesMulti,
  type PlaceSearchCandidate,
} from "./place-id-resolver";
import type { DiagnosticCandidate } from "./places-search-debug";

export interface ResolveUrlDiagnostic {
  inputUrl: string;
  resolvedUrl: string;
  isGoogleBusinessUrl: boolean;
  placeId: string | null;
  placeIdFromResolvedUrl: string | null;
  placeIdFromHtml: string | null;
  businessNameHint: string | null;
  htmlLength: number;
  htmlSnippet: string | null;
  redirectChain: string[];
  searchCandidates: DiagnosticCandidate[];
  notes: string[];
}

function toDiagnostic(candidate: PlaceSearchCandidate): DiagnosticCandidate {
  return {
    placeId: candidate.placeId,
    name: candidate.name,
    rating: candidate.rating,
    reviewCount: candidate.reviewCount,
    website: candidate.website,
    phone: candidate.phone,
    locationLabel: candidate.locationLabel,
    isServiceAreaBusiness: candidate.isServiceAreaBusiness,
  };
}

export async function diagnoseGoogleBusinessLink(
  inputUrl: string,
  apiKey: string,
  hints?: { phone?: string; website?: string },
): Promise<ResolveUrlDiagnostic> {
  const trimmed = inputUrl.trim();
  const notes: string[] = [];
  const redirectChain: string[] = [trimmed];

  const direct = extractPlaceIdFromText(trimmed);
  if (direct) {
    return {
      inputUrl: trimmed,
      resolvedUrl: trimmed,
      isGoogleBusinessUrl: isGoogleBusinessUrl(trimmed),
      placeId: direct,
      placeIdFromResolvedUrl: direct,
      placeIdFromHtml: null,
      businessNameHint: extractBusinessNameFromMapsUrl(trimmed),
      htmlLength: 0,
      htmlSnippet: null,
      redirectChain,
      searchCandidates: [],
      notes: ["Place ID found directly in pasted URL/text."],
    };
  }

  if (!isGoogleBusinessUrl(trimmed)) {
    notes.push("URL does not look like a Google Business or Maps link.");
    return {
      inputUrl: trimmed,
      resolvedUrl: trimmed,
      isGoogleBusinessUrl: false,
      placeId: null,
      placeIdFromResolvedUrl: null,
      placeIdFromHtml: null,
      businessNameHint: null,
      htmlLength: 0,
      htmlSnippet: null,
      redirectChain,
      searchCandidates: [],
      notes,
    };
  }

  const followed = await followRedirectsToFinalUrlForDebug(trimmed);
  redirectChain.push(...followed.chain.filter((url) => url !== trimmed));

  const resolvedUrl = followed.finalUrl;
  const html = followed.html ?? "";
  const placeIdFromResolvedUrl = extractPlaceIdFromText(resolvedUrl);
  const placeIdFromHtml = html ? extractPlaceIdFromText(html) : null;
  const placeId = placeIdFromResolvedUrl ?? placeIdFromHtml ?? null;

  const businessNameHint =
    extractBusinessNameFromMapsUrl(resolvedUrl) ??
    (html ? extractBusinessNameFromHtml(html) : null);

  if (!placeId && !html) {
    notes.push(
      "Redirect fetch returned no HTML. Google may be blocking server-side fetches for share.google links.",
    );
  }

  if (!placeId && html && !placeIdFromHtml) {
    notes.push(
      "Resolved page loaded but no ChIJ Place ID was found in URL or HTML.",
    );
  }

  let searchCandidates: DiagnosticCandidate[] = [];
  if (!placeId && apiKey.trim()) {
    const searchName = businessNameHint ?? "SqueegeeKing";
    const found = await searchGooglePlacesMulti(apiKey, {
      name: searchName,
      phone: hints?.phone,
      website: hints?.website,
      serviceAreaMode: true,
    });
    searchCandidates = found.map(toDiagnostic);
    if (searchCandidates.length === 0) {
      notes.push(
        "Fallback Places search after URL resolve also returned zero candidates.",
      );
    }
  } else if (!placeId && !apiKey.trim()) {
    notes.push("No API key available for fallback Places search.");
  }

  return {
    inputUrl: trimmed,
    resolvedUrl,
    isGoogleBusinessUrl: true,
    placeId,
    placeIdFromResolvedUrl,
    placeIdFromHtml,
    businessNameHint,
    htmlLength: html.length,
    htmlSnippet: html ? html.slice(0, 1200) : null,
    redirectChain,
    searchCandidates,
    notes,
  };
}
