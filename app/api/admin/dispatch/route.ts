import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import {
  normalizeOwnerDispatchMonth,
  OWNER_DISPATCH_MONTH_PATTERN,
} from "@/lib/field-operations/owner-dispatch";
import { loadOwnerDispatchMonth } from "@/lib/field-operations/owner-dispatch-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!authorizeAdminRequest(request.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const requestedMonth = new URL(request.url).searchParams.get("month");
  if (requestedMonth && !OWNER_DISPATCH_MONTH_PATTERN.test(requestedMonth)) {
    return NextResponse.json(
      { error: "Choose a valid dispatch month." },
      { status: 400, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  try {
    const month = normalizeOwnerDispatchMonth(requestedMonth);
    return NextResponse.json(await loadOwnerDispatchMonth(month), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error(
      "[owner-dispatch] load failed",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json(
      { error: "Could not load the Jobber dispatch month." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
