import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import { recordTechnicianOwnerTime } from "@/lib/field-operations/technician-owner-time-server";
export const runtime = "nodejs";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
export async function POST(request: Request, { params }: { params: Promise<{ technicianId: string }> }) {
  if (!authorizeAdminRequest(request.headers)) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: PRIVATE_HEADERS });
  try {
    const { technicianId } = await params;
    const body = await request.json();
    const adjustment = await recordTechnicianOwnerTime({ technicianId, workDate: body.workDate, durationMinutes: body.durationMinutes, resolvedClockId: body.resolvedClockId, reason: body.reason, note: body.note, idempotencyKey: body.idempotencyKey });
    return NextResponse.json({ adjustment }, { status: 201, headers: PRIVATE_HEADERS });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not record owner adjustment." }, { status: 400, headers: PRIVATE_HEADERS });
  }
}
