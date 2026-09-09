import "server-only";

import type { PropertyPhotoView } from "@/lib/member-intelligence/types";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { VISIT_MEDIA_BUCKET } from "./visit-field-record";

export interface TechnicianPhotoEvidence {
  id: string;
  fieldRecordId: string;
  assignmentId: string;
  technicianId: string;
  technicianName: string;
  captureType: "before" | "after" | "detail";
  customerVisible: boolean;
  createdAt: string;
  signedUrl: string | null;
  clientName: string;
  serviceTitle: string;
  visitDate: string;
  propertyId: string | null;
  propertyName: string | null;
  membershipId: string | null;
  memberLinked: boolean;
  jobberBacked: boolean;
}

interface PhotoRow {
  id: string;
  field_record_id: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  capture_type: "before" | "after" | "detail";
  customer_visible: boolean;
  created_at: string;
}

interface CloseoutRow {
  field_record_id: string;
  assignment_id: string;
  technician_id: string;
  technician_display_name: string;
  visit_date: string;
}

interface AssignmentRow {
  id: string;
  connection_id: string;
  projection_id: string | null;
  live_client_name: string | null;
  live_service_title: string | null;
  jobber_visit_projections:
    | { external_property_id: string; client_name: string; title: string | null }
    | Array<{ external_property_id: string; client_name: string; title: string | null }>
    | null;
}

interface PropertyContext {
  propertyId: string | null;
  homeownerId: string | null;
  propertyName: string | null;
  membershipId: string | null;
}

async function propertyContext(input: {
  connectionId: string;
  externalPropertyId: string | null;
}): Promise<PropertyContext> {
  if (!input.externalPropertyId) {
    return { propertyId: null, homeownerId: null, propertyName: null, membershipId: null };
  }
  const supabase = createServiceRoleSupabaseClient();
  const linkResult = await supabase
    .from("jobber_property_links")
    .select("property_id")
    .eq("connection_id", input.connectionId)
    .eq("external_property_id", input.externalPropertyId)
    .eq("link_state", "active")
    .maybeSingle();
  if (linkResult.error || !linkResult.data) {
    return { propertyId: null, homeownerId: null, propertyName: null, membershipId: null };
  }
  const propertyId = (linkResult.data as { property_id: string }).property_id;
  const [propertyResult, membershipResult] = await Promise.all([
    supabase.from("properties").select("name, homeowner_id").eq("id", propertyId).maybeSingle(),
    supabase
      .from("memberships")
      .select("id")
      .eq("property_id", propertyId)
      .in("status", ["active", "pending_payment", "pending"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const property = propertyResult.data as { name?: string; homeowner_id?: string } | null;
  return {
    propertyId,
    homeownerId: property?.homeowner_id ?? null,
    propertyName: property?.name ?? null,
    membershipId:
      membershipResult.data && "id" in membershipResult.data
        ? String((membershipResult.data as { id: string }).id)
        : null,
  };
}

async function loadPhotoEvidenceByRows(
  technicianId: string,
  photoRows: PhotoRow[],
): Promise<TechnicianPhotoEvidence[]> {
  if (!photoRows.length) return [];
  const supabase = createServiceRoleSupabaseClient();
  const fieldRecordIds = [...new Set(photoRows.map((photo) => photo.field_record_id))];
  const closeoutResult = await supabase
    .from("homeatlas_technician_job_closeouts")
    .select("field_record_id, assignment_id, technician_id, technician_display_name, visit_date")
    .eq("technician_id", technicianId)
    .in("field_record_id", fieldRecordIds);
  if (closeoutResult.error) throw new Error("Technician photo closeouts could not be loaded.");
  const closeouts = (closeoutResult.data ?? []) as CloseoutRow[];
  const closeoutByRecord = new Map(closeouts.map((row) => [row.field_record_id, row]));
  const assignmentIds = [...new Set(closeouts.map((row) => row.assignment_id))];
  if (!assignmentIds.length) return [];
  const assignmentResult = await supabase
    .from("homeatlas_technician_visit_assignments")
    .select("id, connection_id, projection_id, live_client_name, live_service_title, jobber_visit_projections(external_property_id, client_name, title)")
    .in("id", assignmentIds);
  if (assignmentResult.error) throw new Error("Technician photo jobs could not be loaded.");
  const assignments = (assignmentResult.data ?? []) as unknown as AssignmentRow[];
  const assignmentById = new Map(assignments.map((row) => [row.id, row]));

  const propertyContextByAssignment = new Map<string, PropertyContext>();
  await Promise.all(
    assignments.map(async (assignment) => {
      const projection = Array.isArray(assignment.jobber_visit_projections)
        ? assignment.jobber_visit_projections[0]
        : assignment.jobber_visit_projections;
      propertyContextByAssignment.set(
        assignment.id,
        await propertyContext({
          connectionId: assignment.connection_id,
          externalPropertyId: projection?.external_property_id ?? null,
        }),
      );
    }),
  );

  return Promise.all(
    photoRows.flatMap((photo) => {
      const closeout = closeoutByRecord.get(photo.field_record_id);
      if (!closeout) return [];
      const assignment = assignmentById.get(closeout.assignment_id);
      if (!assignment) return [];
      const projection = Array.isArray(assignment.jobber_visit_projections)
        ? assignment.jobber_visit_projections[0]
        : assignment.jobber_visit_projections;
      const context = propertyContextByAssignment.get(assignment.id) ?? {
        propertyId: null,
        homeownerId: null,
        propertyName: null,
        membershipId: null,
      };
      return [
        (async (): Promise<TechnicianPhotoEvidence> => {
          const signed = await supabase.storage
            .from(VISIT_MEDIA_BUCKET)
            .createSignedUrl(photo.storage_path, 60 * 30);
          return {
            id: photo.id,
            fieldRecordId: photo.field_record_id,
            assignmentId: closeout.assignment_id,
            technicianId: closeout.technician_id,
            technicianName: closeout.technician_display_name,
            captureType: photo.capture_type,
            customerVisible: photo.customer_visible,
            createdAt: photo.created_at,
            signedUrl: signed.error ? null : signed.data?.signedUrl ?? null,
            clientName: assignment.live_client_name ?? projection?.client_name ?? "SqueegeeKing customer",
            serviceTitle: assignment.live_service_title ?? projection?.title ?? "SqueegeeKing service",
            visitDate: closeout.visit_date,
            propertyId: context.propertyId,
            propertyName: context.propertyName,
            membershipId: context.membershipId,
            memberLinked: Boolean(context.propertyId && context.membershipId),
            jobberBacked: Boolean(assignment.projection_id),
          };
        })(),
      ];
    }),
  );
}

export async function loadTechnicianPhotoEvidence(
  technicianId: string,
  limit = 36,
): Promise<TechnicianPhotoEvidence[]> {
  const supabase = createServiceRoleSupabaseClient();
  const closeoutResult = await supabase
    .from("homeatlas_technician_job_closeouts")
    .select("field_record_id")
    .eq("technician_id", technicianId)
    .order("created_at", { ascending: false })
    .limit(Math.max(limit, 12));
  if (closeoutResult.error) throw new Error("Technician closeouts could not be loaded for photo memory.");
  const recordIds = (closeoutResult.data ?? []).map(
    (row) => (row as { field_record_id: string }).field_record_id,
  );
  if (!recordIds.length) return [];
  const photoResult = await supabase
    .from("homeatlas_technician_job_photos")
    .select("id, field_record_id, storage_path, mime_type, size_bytes, capture_type, customer_visible, created_at")
    .in("field_record_id", recordIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (photoResult.error) throw new Error("Technician photos could not be loaded.");
  return loadPhotoEvidenceByRows(technicianId, (photoResult.data ?? []) as PhotoRow[]);
}

async function syncPublishedPropertyAsset(input: {
  photo: PhotoRow;
  evidence: TechnicianPhotoEvidence;
  customerVisible: boolean;
}): Promise<void> {
  if (!input.evidence.propertyId) return;
  const supabase = createServiceRoleSupabaseClient();
  const propertyResult = await supabase
    .from("properties")
    .select("homeowner_id")
    .eq("id", input.evidence.propertyId)
    .maybeSingle();
  if (propertyResult.error || !propertyResult.data) {
    throw new Error("Member property could not be verified for photo publication.");
  }
  const homeownerId = (propertyResult.data as { homeowner_id: string }).homeowner_id;
  const existingResult = await supabase
    .from("property_assets")
    .select("id, is_primary")
    .eq("storage_bucket", VISIT_MEDIA_BUCKET)
    .eq("storage_path", input.photo.storage_path)
    .maybeSingle();
  if (existingResult.error) throw new Error("Could not verify existing property photo memory.");

  if (!input.customerVisible) {
    if (existingResult.data) {
      const hidden = await supabase
        .from("property_assets")
        .update({ customer_visible: false, is_primary: false })
        .eq("id", (existingResult.data as { id: string }).id);
      if (hidden.error) throw new Error("Could not hide the member property photo.");
    }
    return;
  }

  const primaryResult = await supabase
    .from("property_assets")
    .select("id")
    .eq("property_id", input.evidence.propertyId)
    .eq("kind", "photo")
    .eq("is_primary", true)
    .limit(1);
  if (primaryResult.error) throw new Error("Could not verify the member property cover photo.");
  const makePrimary =
    input.photo.capture_type === "after" && (primaryResult.data ?? []).length === 0;
  const values = {
    property_id: input.evidence.propertyId,
    homeowner_id: homeownerId,
    kind: "photo",
    category: "visit",
    title:
      input.photo.capture_type === "after"
        ? "After service"
        : input.photo.capture_type === "before"
          ? "Before service"
          : "Service detail",
    description: `${input.evidence.serviceTitle} · ${input.evidence.visitDate}`,
    storage_path: input.photo.storage_path,
    storage_bucket: VISIT_MEDIA_BUCKET,
    mime_type: input.photo.mime_type,
    file_size_bytes: input.photo.size_bytes,
    photo_source: "our_team",
    capture_type: input.photo.capture_type,
    customer_visible: true,
    captured_by: input.evidence.technicianName,
    field_record_id: input.evidence.fieldRecordId,
    captured_at: input.photo.created_at,
    is_primary:
      makePrimary || Boolean(existingResult.data && (existingResult.data as { is_primary?: boolean }).is_primary),
  };
  const write = existingResult.data
    ? await supabase
        .from("property_assets")
        .update(values)
        .eq("id", (existingResult.data as { id: string }).id)
    : await supabase.from("property_assets").insert(values);
  if (write.error) throw new Error("Could not add this proof to the member property history.");
}

export async function setTechnicianPhotoCustomerVisibility(input: {
  technicianId: string;
  photoId: string;
  customerVisible: boolean;
  actor?: string;
}): Promise<TechnicianPhotoEvidence> {
  const supabase = createServiceRoleSupabaseClient();
  const photoResult = await supabase
    .from("homeatlas_technician_job_photos")
    .select("id, field_record_id, storage_path, mime_type, size_bytes, capture_type, customer_visible, created_at")
    .eq("id", input.photoId)
    .maybeSingle();
  if (photoResult.error || !photoResult.data) throw new Error("Technician photo not found.");
  const photo = photoResult.data as PhotoRow;
  const current = (await loadPhotoEvidenceByRows(input.technicianId, [photo]))[0];
  if (!current) throw new Error("That photo does not belong to this technician.");
  if (input.customerVisible && !current.memberLinked) {
    throw new Error("Link this Jobber property to a HomeAtlas member before publishing the photo.");
  }
  if (current.customerVisible === input.customerVisible) return current;

  await syncPublishedPropertyAsset({
    photo,
    evidence: current,
    customerVisible: input.customerVisible,
  });
  const updateResult = await supabase
    .from("homeatlas_technician_job_photos")
    .update({ customer_visible: input.customerVisible })
    .eq("id", input.photoId);
  if (updateResult.error) throw new Error("Could not update photo visibility.");
  const eventResult = await supabase.from("homeatlas_technician_photo_publication_events").insert({
    photo_id: input.photoId,
    technician_id: input.technicianId,
    property_id: current.propertyId,
    previous_customer_visible: current.customerVisible,
    customer_visible: input.customerVisible,
    actor: input.actor?.trim() || "HomeAtlas HQ",
  });
  if (eventResult.error) throw new Error("Photo visibility changed but its audit event could not be saved.");
  return { ...current, customerVisible: input.customerVisible };
}

export async function loadNativePortalPropertyPhotos(
  propertyId: string,
  limit = 24,
): Promise<PropertyPhotoView[]> {
  const supabase = createServiceRoleSupabaseClient();
  const result = await supabase
    .from("property_assets")
    .select("id, field_record_id, storage_path, title, capture_type, captured_by, is_primary, captured_at, created_at")
    .eq("property_id", propertyId)
    .eq("kind", "photo")
    .eq("category", "visit")
    .eq("customer_visible", true)
    .eq("storage_bucket", VISIT_MEDIA_BUCKET)
    .order("captured_at", { ascending: false })
    .limit(limit);
  if (result.error) return [];
  const mapped = await Promise.all(
    (result.data ?? []).map(async (row): Promise<PropertyPhotoView | null> => {
      const photo = row as {
        id: string;
        field_record_id: string | null;
        storage_path: string;
        title: string;
        capture_type: "before" | "after" | "detail" | null;
        captured_by: string | null;
        is_primary: boolean;
        captured_at: string | null;
        created_at: string;
      };
      const signed = await supabase.storage
        .from(VISIT_MEDIA_BUCKET)
        .createSignedUrl(photo.storage_path, 60 * 60);
      if (signed.error || !signed.data?.signedUrl) return null;
      return {
        id: photo.id,
        fieldRecordId: photo.field_record_id,
        source: "our_team",
        url: signed.data.signedUrl,
        caption: photo.title,
        isPrimary: photo.is_primary,
        uploadedAt: photo.captured_at ?? photo.created_at,
        captureType: photo.capture_type,
        capturedBy: photo.captured_by,
      };
    }),
  );
  return mapped.filter((photo): photo is PropertyPhotoView => photo !== null);
}
