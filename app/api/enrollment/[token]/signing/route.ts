import { NextResponse } from "next/server";
import {
  createPublicEnrollmentSigningSession,
  EnrollmentSigningUnavailableError,
} from "@/lib/enrollment/public-signing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  try {
    const url = await createPublicEnrollmentSigningSession(token);
    if (!url) {
      return NextResponse.json(
        { error: "Enrollment handoff not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { url },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof EnrollmentSigningUnavailableError) {
      return NextResponse.json(
        { error: error.message },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }
    console.error("[enrollment-signing] recipient view failed", {
      message: error instanceof Error ? error.message : "Unknown provider error",
    });
    return NextResponse.json(
      { error: "The secure signing window could not open. Please try again." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
