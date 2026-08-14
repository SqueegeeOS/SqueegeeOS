import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import { commitVisitFieldRecord } from "@/lib/field-records/visit-field-record-server";
import type { VisitFieldRecordCommitInput } from "@/lib/field-records/visit-field-record";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!authorizeAdminRequest(request.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const input = (await request.json()) as VisitFieldRecordCommitInput;
    const result = await commitVisitFieldRecord(input);
    return NextResponse.json(result, {
      status: 201,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not save the visit record.";
    const status = /not found|does not belong|valid|must|Add|photo|Enter/i.test(
      message,
    )
      ? 400
      : 503;
    return NextResponse.json(
      { error: message },
      { status, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
