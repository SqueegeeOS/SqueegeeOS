import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import {
  loadTechnicianCapacitySnapshot,
  recordTechnicianCapacityPlan,
} from "@/lib/field-operations/technician-capacity-server";
import type { RecordTechnicianCapacityPlanInput } from "@/lib/field-operations/technician-capacity";

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
    return NextResponse.json(await loadTechnicianCapacitySnapshot(), {
      headers: PRIVATE_HEADERS,
    });
  } catch (error) {
    console.error("[technician-capacity] snapshot failed", error);
    return NextResponse.json(
      { error: "Technician capacity truth could not load." },
      { status: 503, headers: PRIVATE_HEADERS },
    );
  }
}

export async function POST(request: Request) {
  if (!authorizeAdminRequest(request.headers)) return unauthorized();
  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  if (!body || body.action !== "record_capacity_plan") {
    return NextResponse.json(
      { error: "Choose a valid technician capacity action." },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  }
  try {
    const plan = await recordTechnicianCapacityPlan(
      body as unknown as RecordTechnicianCapacityPlanInput,
    );
    return NextResponse.json(
      { plan },
      { status: 201, headers: PRIVATE_HEADERS },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Capacity plan could not be saved.";
    console.error("[technician-capacity] action failed", message);
    return NextResponse.json(
      { error: message },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  }
}
