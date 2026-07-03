import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/pin";
import { resolvePlaceIdFromMapsUrl } from "@/lib/reviews/place-id-resolver";

export async function POST(request: Request) {
  const pinHeader = request.headers.get("x-admin-pin");
  if (!authorizeAdminRequest(pinHeader)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { url?: string };
  const url = body.url?.trim() ?? "";

  if (!url) {
    return NextResponse.json(
      { error: "Paste a Google Maps or Google Business link." },
      { status: 400 },
    );
  }

  const { placeId, resolvedUrl } = await resolvePlaceIdFromMapsUrl(url);

  return NextResponse.json({
    placeId,
    resolvedUrl,
    found: Boolean(placeId),
  });
}
