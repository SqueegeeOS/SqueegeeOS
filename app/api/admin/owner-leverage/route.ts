import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import {
  finishGrowthWorkSession,
  loadOwnerLeverageSnapshot,
  startGrowthWorkSession,
} from "@/lib/admin/owner-leverage-server";
import type { GrowthChannel } from "@/lib/admin/owner-leverage";
import { recordFieldIndependenceReview } from "@/lib/field-operations/independence-review-server";
import type { RecordFieldIndependenceReviewInput } from "@/lib/field-operations/independence-review";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

function unauthorized() {
  return NextResponse.json(
    { error: "Unauthorized" },
    { status: 401, headers: PRIVATE_HEADERS },
  );
}

export async function GET(request: Request) {
  if (!authorizeAdminRequest(request.headers)) return unauthorized();
  try {
    return NextResponse.json(await loadOwnerLeverageSnapshot(), {
      headers: PRIVATE_HEADERS,
    });
  } catch (error) {
    console.error("[owner-leverage] snapshot failed", error);
    return NextResponse.json(
      { error: "Owner leverage truth could not load." },
      { status: 503, headers: PRIVATE_HEADERS },
    );
  }
}

export async function POST(request: Request) {
  if (!authorizeAdminRequest(request.headers)) return unauthorized();
  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  if (!body || typeof body.action !== "string") {
    return NextResponse.json(
      { error: "Choose a valid owner leverage action." },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  }

  try {
    if (body.action === "start_growth_session") {
      const session = await startGrowthWorkSession({
        operatorSlug: String(body.operatorSlug ?? ""),
        channel: body.channel as GrowthChannel,
      });
      return NextResponse.json({ session }, { headers: PRIVATE_HEADERS });
    }
    if (body.action === "finish_growth_session") {
      const session = await finishGrowthWorkSession({
        sessionId: String(body.sessionId ?? ""),
        breakMinutes: Number(body.breakMinutes ?? 0),
        notes: typeof body.notes === "string" ? body.notes : undefined,
      });
      return NextResponse.json({ session }, { headers: PRIVATE_HEADERS });
    }
    if (body.action === "cancel_growth_session") {
      const session = await finishGrowthWorkSession({
        sessionId: String(body.sessionId ?? ""),
        breakMinutes: 0,
        notes: typeof body.notes === "string" ? body.notes : undefined,
        cancel: true,
      });
      return NextResponse.json({ session }, { headers: PRIVATE_HEADERS });
    }
    if (body.action === "record_field_review") {
      const review = await recordFieldIndependenceReview(
        body as unknown as RecordFieldIndependenceReviewInput,
      );
      return NextResponse.json({ review }, { headers: PRIVATE_HEADERS });
    }
    return NextResponse.json(
      { error: "Owner leverage action is not supported." },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Owner leverage action failed.";
    console.error("[owner-leverage] action failed", message);
    return NextResponse.json(
      { error: message },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  }
}
