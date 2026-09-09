import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import {
  isTechnicianProfileId,
} from "@/lib/field-operations/technician-profile";
import { loadTechnicianOperationalProfile } from "@/lib/field-operations/technician-profile-server";

export const runtime = "nodejs";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

export async function GET(
  request: Request,
  { params }: { params: Promise<{ technicianId: string }> },
) {
  if (!authorizeAdminRequest(request.headers)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: PRIVATE_HEADERS },
    );
  }

  const { technicianId } = await params;
  if (!isTechnicianProfileId(technicianId)) {
    return NextResponse.json(
      { error: "Choose a valid technician profile." },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  }

  try {
    const profile = await loadTechnicianOperationalProfile(technicianId);
    if (!profile) {
      return NextResponse.json(
        { error: "Technician profile not found." },
        { status: 404, headers: PRIVATE_HEADERS },
      );
    }
    return NextResponse.json({ profile }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error("[technician-profile] load failed", error);
    return NextResponse.json(
      { error: "Technician backend data could not load safely." },
      { status: 503, headers: PRIVATE_HEADERS },
    );
  }
}
