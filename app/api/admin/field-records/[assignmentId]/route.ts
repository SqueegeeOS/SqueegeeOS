import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { VISIT_MEDIA_BUCKET, fieldAssignmentPhotoStoragePrefix } from "@/lib/field-records/visit-field-record";
import type { FieldCloseoutReview } from "@/lib/field-records/field-closeout-review";

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
