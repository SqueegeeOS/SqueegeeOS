import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import { isTechnicianProfileId } from "@/lib/field-operations/technician-profile";
import { setTechnicianPhotoCustomerVisibility } from "@/lib/field-records/technician-photo-memory-server";

export const runtime = "nodejs";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ technicianId: string; photoId: string }> },
) {
  if (!authorizeAdminRequest(request.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: PRIVATE_HEADERS });
  }
  const { technicianId, photoId } = await params;
  if (!isTechnicianProfileId(technicianId) || !UUID_PATTERN.test(photoId)) {
    return NextResponse.json({ error: "Choose a valid technician photo." }, { status: 400, headers: PRIVATE_HEADERS });
  }
  try {
    const body = (await request.json()) as { customerVisible?: boolean };
    if (typeof body.customerVisible !== "boolean") {
      throw new Error("Choose whether this photo should be visible to the member.");
    }
    const photo = await setTechnicianPhotoCustomerVisibility({
      technicianId,
      photoId,
      customerVisible: body.customerVisible,
    });
    return NextResponse.json({ photo }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update photo visibility." },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  }
}
