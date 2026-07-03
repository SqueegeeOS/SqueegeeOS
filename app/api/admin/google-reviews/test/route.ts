import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/pin";
import { testGoogleReviewsConnection } from "@/lib/reviews/place-id-resolver";

export async function POST(request: Request) {
  const pinHeader = request.headers.get("x-admin-pin");
  if (!authorizeAdminRequest(pinHeader)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    apiKey?: string;
    placeId?: string;
  };

  const result = await testGoogleReviewsConnection(
    body.apiKey ?? "",
    body.placeId ?? "",
  );

  return NextResponse.json(result);
}
