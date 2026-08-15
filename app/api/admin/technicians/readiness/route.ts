import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import {
  cancelTechnicianIndependentDay,
  loadTechnicianReadinessSnapshot,
  planTechnicianIndependentDay,
  recordTechnicianCompetencyAssessment,
} from "@/lib/field-operations/technician-readiness-server";
import type {
  PlanIndependentDayInput,
  RecordTechnicianCompetencyInput,
} from "@/lib/field-operations/technician-readiness";

export const runtime = "nodejs";

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
    return NextResponse.json(await loadTechnicianReadinessSnapshot(), {
      headers: PRIVATE_HEADERS,
    });
  } catch (error) {
    console.error("[technician-readiness] snapshot failed", error);
    return NextResponse.json(
      { error: "Technician readiness truth could not load." },
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
      { error: "Choose a valid technician readiness action." },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  }

  try {
    if (body.action === "record_competency") {
      const assessment = await recordTechnicianCompetencyAssessment(
        body as unknown as RecordTechnicianCompetencyInput,
      );
      return NextResponse.json(
        { assessment },
        { status: 201, headers: PRIVATE_HEADERS },
      );
    }
    if (body.action === "plan_independent_day") {
      const trial = await planTechnicianIndependentDay(
        body as unknown as PlanIndependentDayInput,
      );
      return NextResponse.json(
        { trial },
        { status: 201, headers: PRIVATE_HEADERS },
      );
    }
    if (body.action === "cancel_independent_day") {
      const trial = await cancelTechnicianIndependentDay({
        trialId: String(body.trialId ?? ""),
        reason: String(body.reason ?? ""),
      });
      return NextResponse.json({ trial }, { headers: PRIVATE_HEADERS });
    }
    return NextResponse.json(
      { error: "Technician readiness action is not supported." },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Technician readiness action failed.";
    console.error("[technician-readiness] action failed", message);
    return NextResponse.json(
      { error: message },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  }
}
