import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import { resolveVisitFieldFollowUp } from "@/lib/field-records/visit-field-follow-up-server";
import type { ResolveVisitFieldFollowUpInput } from "@/lib/field-records/visit-field-record";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  if (!authorizeAdminRequest(request.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const input = (await request.json()) as ResolveVisitFieldFollowUpInput;
    const result = await resolveVisitFieldFollowUp(input);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not resolve the follow-up.";
    const status = /must|Enter|not found|Invalid/i.test(message) ? 400 : 503;
    return NextResponse.json(
      { error: message },
      { status, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
