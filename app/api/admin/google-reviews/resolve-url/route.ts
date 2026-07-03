import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/pin";
import { resolveGoogleBusinessLink } from "@/lib/reviews/place-id-resolver";

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
  const apiKey = body.apiKey?.trim() ?? "";

  if (!url) {
    return NextResponse.json(
      { error: "Paste a Google Maps or Google Business link." },
      { status: 400 },
    );
  }

  const result = await resolveGoogleBusinessLink(url, apiKey, {
    phone: body.phone,
    website: body.website,
  });

  return NextResponse.json({
    placeId: result.placeId,
    resolvedUrl: result.resolvedUrl,
    businessNameHint: result.businessNameHint,
    candidates: result.candidates,
    method: result.method,
    found: Boolean(result.placeId),
    needsSelection: !result.placeId && result.candidates.length > 0,
  });
}
