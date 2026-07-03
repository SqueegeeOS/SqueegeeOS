import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/pin";
import {
  searchGooglePlacesMulti,
  type BusinessSearchInput,
} from "@/lib/reviews/place-id-resolver";

export async function POST(request: Request) {
  const pinHeader = request.headers.get("x-admin-pin");
  if (!authorizeAdminRequest(pinHeader)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    apiKey?: string;
    query?: string;
    phone?: string;
    website?: string;
    serviceAreaMode?: boolean;
  };

  const input: BusinessSearchInput = {
    name: body.query ?? "",
    phone: body.phone,
    website: body.website,
    serviceAreaMode: body.serviceAreaMode,
  };

  const results = await searchGooglePlacesMulti(body.apiKey ?? "", input);

  return NextResponse.json({ results });
}
