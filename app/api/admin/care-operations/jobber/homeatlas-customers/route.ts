import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/pin";
import { searchHomeAtlasCustomers } from "@/lib/care-operations/jobber-customer-matching";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!authorizeAdminRequest(request.headers.get("x-admin-pin"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  try {
    return NextResponse.json(
      await searchHomeAtlasCustomers({
        search: url.searchParams.get("search") ?? "",
        limit: Number.parseInt(url.searchParams.get("limit") ?? "30", 10),
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Customer search failed";
    console.error("[jobber-homeatlas-customers] search failed:", message);
    return NextResponse.json(
      { error: "Could not search HomeAtlas customers." },
      { status: 503 },
    );
  }
}
