import "server-only";

import { randomUUID } from "node:crypto";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
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
}

interface FieldRecordRpcRow {
  assessment_id: string;
  asset_count: number;
}

async function assertVisitScope(
  propertyId: string,
  appointmentId: string,
): Promise<PropertyScopeRow> {
  const supabase = createServiceRoleSupabaseClient();
  const [propertyResult, appointmentResult] = await Promise.all([
    supabase
      .from("properties")
      .select("id, homeowner_id")
      .eq("id", propertyId)
      .maybeSingle(),
    supabase
      .from("member_appointments")
      .select("id, property_id")
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
  return property;
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

  await assertVisitScope(input.propertyId, input.appointmentId);
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
