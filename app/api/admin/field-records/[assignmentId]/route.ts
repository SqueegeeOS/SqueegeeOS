import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { VISIT_MEDIA_BUCKET, fieldAssignmentPhotoStoragePrefix } from "@/lib/field-records/visit-field-record";
import type { FieldCloseoutReview } from "@/lib/field-records/field-closeout-review";
import { FIELD_RECORD_UUID } from "@/lib/field-records/field-closeout-review";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request, context: { params: Promise<{ assignmentId: string }> }) {
  if (!authorizeAdminRequest(request.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }
  const { assignmentId } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(assignmentId)) {
    return NextResponse.json({ error: "Invalid assignment." }, { status: 400, headers });
  }
  try {
    const supabase = createServiceRoleSupabaseClient();
    const record = await supabase.from("homeatlas_technician_job_closeouts")
      .select("field_record_id, technician_display_name, visit_date, created_at, customer_summary, internal_note, scope_exception, follow_up_needed")
      .eq("assignment_id", assignmentId).maybeSingle();
    if (record.error) throw new Error("Closeout lookup failed");
    if (!record.data) return NextResponse.json({ error: "No closeout has been submitted for this visit." }, { status: 404, headers });
    const row = record.data;
    const resolutionResult = await supabase.from("homeatlas_technician_issue_resolutions")
      .select("resolution_note, resolved_by, resolved_at").eq("field_record_id", row.field_record_id).maybeSingle();
    if (resolutionResult.error) throw new Error("Resolution lookup failed");
    const resolution = resolutionResult.data;
    const result = await supabase.from("homeatlas_technician_job_photos")
      .select("id, storage_path, capture_type, mime_type")
      .eq("field_record_id", row.field_record_id).order("created_at");
    if (result.error) throw new Error("Photo lookup failed");
    const prefix = fieldAssignmentPhotoStoragePrefix({ fieldAssignmentId: assignmentId, fieldRecordId: row.field_record_id });
    const photos = await Promise.all((result.data ?? []).map(async photo => {
      const objectName = photo.storage_path.startsWith(prefix) ? photo.storage_path.slice(prefix.length) : "";
      // Only sign objects stored under this exact closeout; never an arbitrary path.
      const validPath = /^[0-9a-f-]+\.(jpg|png|webp|heic|heif)$/i.test(objectName);
      const signed = validPath
        ? await supabase.storage.from(VISIT_MEDIA_BUCKET).createSignedUrl(photo.storage_path, 300)
        : null;
      return { id: photo.id, captureType: photo.capture_type, mimeType: photo.mime_type, url: signed?.error ? null : signed?.data?.signedUrl ?? null };
    }));
    const review: FieldCloseoutReview = {
      fieldRecordId: row.field_record_id,
      resolution: resolution ? { note: resolution.resolution_note, resolvedBy: resolution.resolved_by, resolvedAt: resolution.resolved_at } : null,
      technicianName: row.technician_display_name,
      visitDate: row.visit_date,
      savedAt: row.created_at,
      customerSummary: row.customer_summary,
      internalNote: row.internal_note,
      scopeException: row.scope_exception,
      followUpNeeded: row.follow_up_needed,
      photos,
    };
    return NextResponse.json(review, { headers });
  } catch {
    return NextResponse.json({ error: "Could not load the visit evidence. Try again." }, { status: 503, headers });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ assignmentId: string }> }) {
  if (!authorizeAdminRequest(request.headers)) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  // Cookie-authenticated owner action. Reject opaque/cross-site/missing origins.
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403, headers });
  }
  const { assignmentId } = await context.params;
  const body = await request.json().catch(() => null);
  if (!FIELD_RECORD_UUID.test(assignmentId) || !body || typeof body.fieldRecordId !== "string" ||
      !FIELD_RECORD_UUID.test(body.fieldRecordId) || typeof body.note !== "string" ||
      body.note.trim().length < 3 || body.note.trim().length > 1200) {
    return NextResponse.json({ error: "Enter a resolution note between 3 and 1,200 characters for this closeout." }, { status: 400, headers });
  }
  try {
    const result = await createServiceRoleSupabaseClient().rpc("resolve_homeatlas_technician_issue", {
      p_assignment_id: assignmentId, p_field_record_id: body.fieldRecordId,
      p_resolution_note: body.note.trim(), p_resolved_by: "Authenticated HQ operator",
    }).single();
    if (result.error || !result.data) {
      if (result.error?.code === "23505") return NextResponse.json({ error: "Already resolved. Refresh evidence to see the saved note." }, { status: 409, headers });
      if (result.error?.code === "P0002") return NextResponse.json({ error: "This closeout is no longer available. Refresh evidence." }, { status: 404, headers });
      if (result.error?.code === "22023") return NextResponse.json({ error: "This closeout has no issue to resolve." }, { status: 400, headers });
      throw new Error("Resolution failed");
    }
    const saved = result.data as { resolution_note: string; resolved_by: string; resolved_at: string };
    return NextResponse.json({ resolution: { note: saved.resolution_note, resolvedBy: saved.resolved_by, resolvedAt: saved.resolved_at } }, { headers });
  } catch {
    return NextResponse.json({ error: "Could not save the resolution. Your note is kept; try again." }, { status: 503, headers });
  }
}
