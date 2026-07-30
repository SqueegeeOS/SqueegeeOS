import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import {
  AtlasPulseManualCompletionError,
  setAtlasPulseManualCompletion,
} from "@/lib/activation/atlas-pulse-manual-completion";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!authorizeAdminRequest(request.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { membershipId?: unknown; completed?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.membershipId !== "string" || typeof body.completed !== "boolean") {
    return NextResponse.json(
      { error: "Choose a membership and completion state." },
      { status: 400 },
    );
  }

  try {
    const manualCompletion = await setAtlasPulseManualCompletion({
      membershipId: body.membershipId,
      completed: body.completed,
    });
    return NextResponse.json({
      manualCompletion,
      message: body.completed
        ? "Email and portal marked complete by founder confirmation."
        : "Founder confirmation removed; provider evidence was preserved.",
    });
  } catch (error) {
    if (error instanceof AtlasPulseManualCompletionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    const message = error instanceof Error ? error.message : "Write failed";
    console.error("[atlas-pulse] founder confirmation failed:", message);
    return NextResponse.json(
      { error: "The founder confirmation was not changed. Try again." },
      { status: 503 },
    );
  }
}
