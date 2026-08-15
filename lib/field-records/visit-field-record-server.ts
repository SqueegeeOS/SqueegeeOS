import "server-only";

import { randomUUID } from "node:crypto";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { readJobberTodayVisitScope } from "@/lib/care-operations/jobber-today-types";
import { JOBBER_CONNECTION_ID } from "@/lib/care-operations/jobber-oauth-config";
import {
  buildVisitPhotoStoragePath,
  type VisitFieldRecordCommitInput,
  type VisitPhotoUploadIntent,
  type VisitPhotoMimeType,
  type VisitPhotoUploadRequest,
  VISIT_MEDIA_BUCKET,
  validateVisitFieldRecordCommit,
  validateVisitPhotoUploadRequest,
} from "./visit-field-record";

interface PropertyScopeRow {
  id: string;
  homeowner_id: string;
}

interface AppointmentScopeRow {
  id: string;
  property_id: string;
  provider: string | null;
  external_id: string | null;
}

interface FieldRecordRpcRow {
  assessment_id: string;
  asset_count: number;
}

async function assertVisitScope(
  propertyId: string,
  appointmentId: string,
): Promise<{
  property: PropertyScopeRow;
  appointment: AppointmentScopeRow;
}> {
  const supabase = createServiceRoleSupabaseClient();
  const [propertyResult, appointmentResult] = await Promise.all([
    supabase
      .from("properties")
      .select("id, homeowner_id")
      .eq("id", propertyId)
      .maybeSingle(),
    supabase
      .from("member_appointments")
      .select("id, property_id, provider, external_id")
      .eq("id", appointmentId)
      .maybeSingle(),
  ]);

  if (propertyResult.error || !propertyResult.data) {
    throw new Error("HomeAtlas property not found.");
  }
  if (appointmentResult.error || !appointmentResult.data) {
    throw new Error("HomeAtlas appointment not found.");
  }

  const property = propertyResult.data as PropertyScopeRow;
  const appointment = appointmentResult.data as AppointmentScopeRow;
  if (appointment.property_id !== property.id) {
    throw new Error("The appointment does not belong to this property.");
  }
  return { property, appointment };
}

async function assertMirroredJobberServiceScope(
  input: VisitFieldRecordCommitInput,
  appointment: AppointmentScopeRow,
): Promise<void> {
  if (appointment.provider !== "jobber" || !appointment.external_id) {
    if (input.serviceScope.length > 0) {
      throw new Error("This appointment has no Jobber service scope to verify.");
    }
    return;
  }

  const supabase = createServiceRoleSupabaseClient();
  const projectionResult = await supabase
    .from("jobber_visit_projections")
    .select("raw_payload")
    .eq("connection_id", JOBBER_CONNECTION_ID)
    .eq("external_visit_id", appointment.external_id)
    .maybeSingle();
  if (projectionResult.error) {
    throw new Error("Could not verify the current Jobber service scope.");
  }
  if (!projectionResult.data) {
    if (input.serviceScope.length > 0 || input.scopeReadState !== "not_observed") {
      throw new Error("Refresh the Jobber visit before saving its service scope.");
    }
    return;
  }

  const mirrored = readJobberTodayVisitScope(
    (projectionResult.data as { raw_payload: unknown }).raw_payload,
  );
  if (mirrored.scopeReadState !== input.scopeReadState) {
    throw new Error("Jobber service-scope visibility changed. Refresh Today.");
  }

  const submittedById = new Map(
    input.serviceScope.map((item) => [item.id, item]),
  );
  if (submittedById.size !== mirrored.scopeItems.length) {
    throw new Error("The Jobber service scope changed. Refresh Today.");
  }
  for (const source of mirrored.scopeItems) {
    const submitted = submittedById.get(source.id);
    if (
      !submitted ||
      submitted.name.trim() !== source.name ||
      (submitted.description?.trim() || null) !== source.description ||
      submitted.quantity !== source.quantity ||
      (submitted.category?.trim() || null) !== source.category
    ) {
      throw new Error("The Jobber service scope changed. Refresh Today.");
    }
  }
}

export async function createVisitPhotoUploadIntents(
  input: VisitPhotoUploadRequest,
): Promise<{ bucket: string; uploads: VisitPhotoUploadIntent[] }> {
  const validationError = validateVisitPhotoUploadRequest(input);
  if (validationError) throw new Error(validationError);

  await assertVisitScope(input.propertyId, input.appointmentId);
  const supabase = createServiceRoleSupabaseClient();
  const uploads: VisitPhotoUploadIntent[] = [];

  for (const photo of input.photos) {
    const storagePath = buildVisitPhotoStoragePath({
      propertyId: input.propertyId,
      appointmentId: input.appointmentId,
      fieldRecordId: input.fieldRecordId,
      objectId: randomUUID(),
      mimeType: photo.mimeType as VisitPhotoMimeType,
    });
    const signed = await supabase.storage
      .from(VISIT_MEDIA_BUCKET)
      .createSignedUploadUrl(storagePath, { upsert: false });
    if (signed.error || !signed.data?.token) {
      throw new Error("Could not prepare private photo upload.");
    }
    uploads.push({
      ...photo,
      storagePath,
      token: signed.data.token,
    });
  }

  return { bucket: VISIT_MEDIA_BUCKET, uploads };
}

async function assertUploadedPhotosExist(
  photos: VisitFieldRecordCommitInput["photos"],
): Promise<void> {
  if (photos.length === 0) return;
  const supabase = createServiceRoleSupabaseClient();
  for (const photo of photos) {
    const result = await supabase.storage
      .from(VISIT_MEDIA_BUCKET)
      .exists(photo.storagePath);
    if (result.error || result.data !== true) {
      throw new Error("A visit photo did not finish uploading. Try that photo again.");
    }
  }
}

export async function commitVisitFieldRecord(
  input: VisitFieldRecordCommitInput,
): Promise<{
  fieldRecordId: string;
  assessmentId: string;
  photoCount: number;
}> {
  const validationError = validateVisitFieldRecordCommit(input);
  if (validationError) throw new Error(validationError);

  const scope = await assertVisitScope(input.propertyId, input.appointmentId);
  await assertMirroredJobberServiceScope(input, scope.appointment);
  await assertUploadedPhotosExist(input.photos);

  const supabase = createServiceRoleSupabaseClient();
  const result = await supabase
    .rpc("commit_visit_field_record", {
      p_field_record_id: input.fieldRecordId,
      p_property_id: input.propertyId,
      p_appointment_id: input.appointmentId,
      p_technician_name: input.technicianName.trim(),
      p_visit_date: input.visitDate,
      p_customer_note: input.customerSummary.trim(),
      p_internal_note: input.internalNote.trim(),
      p_follow_up_needed: input.followUpNeeded,
      p_scope_read_state: input.scopeReadState,
      p_service_scope: input.serviceScope.map((item) => ({
        id: item.id,
        name: item.name.trim(),
        description: item.description?.trim() || null,
        quantity: item.quantity,
        category: item.category?.trim() || null,
        completed: item.completed,
      })),
      p_scope_exception: input.scopeException.trim(),
      p_assets: input.photos.map((photo) => ({
        clientId: photo.clientId,
        storagePath: photo.storagePath,
        mimeType: photo.mimeType,
        sizeBytes: photo.sizeBytes,
        captureType: photo.captureType,
        customerVisible: photo.customerVisible,
      })),
    })
    .single();

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "Could not save the visit record.");
  }
  const row = result.data as FieldRecordRpcRow;
  return {
    fieldRecordId: input.fieldRecordId,
    assessmentId: row.assessment_id,
    photoCount: Number(row.asset_count),
  };
}
