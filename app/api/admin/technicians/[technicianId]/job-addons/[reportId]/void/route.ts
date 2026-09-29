import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import { isTechnicianProfileId } from "@/lib/field-operations/technician-profile";
import { isJobAddonAssignmentId } from "@/lib/field-operations/technician-job-addon";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";

export const runtime = "nodejs";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

export async function POST(request: Request, { params }: {
  params: Promise<{ technicianId: string; reportId: string }>;
}) {
  if (!authorizeAdminRequest(request.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: PRIVATE_HEADERS });
  }
  const { technicianId, reportId } = await params;
  if (!isTechnicianProfileId(technicianId) || !isJobAddonAssignmentId(reportId)) {
    return NextResponse.json({ error: "Choose a valid technician add-on." }, { status: 400, headers: PRIVATE_HEADERS });
  }
  let body: unknown;
  try { body = await request.json(); } catch { body = null; }
  const reason = body && typeof body === "object" && "reason" in body && typeof body.reason === "string"
    ? body.reason.trim() : "";
  if (reason.length < 3 || reason.length > 500) {
    return NextResponse.json({ error: "Enter a short correction reason." }, { status: 400, headers: PRIVATE_HEADERS });
  }
  const result = await createServiceRoleSupabaseClient()
    .from("homeatlas_technician_job_addon_reports")
    .update({ voided_at: new Date().toISOString(), voided_by: "HomeAtlas HQ", void_reason: reason })
    .eq("id", reportId)
    .eq("technician_id", technicianId)
    .is("voided_at", null)
    .select("id")
    .maybeSingle();
  if (result.error) {
    return NextResponse.json({ error: "Could not correct this add-on." }, { status: 503, headers: PRIVATE_HEADERS });
  }
  if (!result.data) {
    return NextResponse.json({ error: "This add-on is missing or already corrected." }, { status: 409, headers: PRIVATE_HEADERS });
  }
  return NextResponse.json({ corrected: true }, { headers: PRIVATE_HEADERS });
}
