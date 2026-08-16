import { NextResponse } from "next/server";
import { loadPublicEnrollmentStatus } from "@/lib/enrollment/public-status";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const status = await loadPublicEnrollmentStatus(token);
  if (!status) {
    return NextResponse.json(
      { error: "Enrollment handoff not found" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(status, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
