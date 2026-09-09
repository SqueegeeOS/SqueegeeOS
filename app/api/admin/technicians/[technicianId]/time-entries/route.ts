import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import { isTechnicianProfileId } from "@/lib/field-operations/technician-profile";
import {
  recordTechnicianManualTime,
  type TechnicianManualTimeReason,
} from "@/lib/field-operations/technician-manual-time-server";

export const runtime = "nodejs";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ technicianId: string }> },
) {
  if (!authorizeAdminRequest(request.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: PRIVATE_HEADERS });
  }
  const { technicianId } = await params;
  if (!isTechnicianProfileId(technicianId)) {
    return NextResponse.json({ error: "Choose a valid technician." }, { status: 400, headers: PRIVATE_HEADERS });
  }
  try {
    const body = (await request.json()) as {
      assignmentId?: string | null;
      workDate?: string;
      startTime?: string;
      endTime?: string;
      reason?: TechnicianManualTimeReason;
      note?: string | null;
    };
    const entry = await recordTechnicianManualTime({
      technicianId,
      assignmentId: body.assignmentId ?? null,
      workDate: body.workDate ?? "",
      startTime: body.startTime ?? "",
      endTime: body.endTime ?? "",
      reason: body.reason ?? "missed_clock",
      note: body.note ?? "",
    });
    return NextResponse.json({ entry }, { status: 201, headers: PRIVATE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save technician time." },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  }
}
