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

async function propertyContext(input: {
  connectionId: string;
  externalPropertyId: string | null;
}): Promise<{ propertyId: string | null; propertyName: string | null; membershipId: string | null }> {
  if (!input.externalPropertyId) {
    return { propertyId: null, propertyName: null, membershipId: null };
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
    return { propertyId: null, propertyName: null, membershipId: null };
  }
  const propertyId = (linkResult.data as { property_id: string }).property_id;
  const [propertyResult, membershipResult] = await Promise.all([
    supabase.from("properties").select("name").eq("id", propertyId).maybeSingle(),
    supabase
      .from("memberships")
      .select("id")
      .eq("property_id", propertyId)
      .in("status", ["active", "pending_payment", "pending"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return {
    propertyId,
    propertyName:
      propertyResult.data && "name" in propertyResult.data
        ? String((propertyResult.data as { name: string }).name)
        : null,
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

  const propertyContextByAssignment = new Map<
    string,
    { propertyId: string | null; propertyName: string | null; membershipId: string | null }
  >();
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
    .select("id, field_record_id, storage_path, capture_type, customer_visible, created_at")
    .in("field_record_id", recordIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (photoResult.error) throw new Error("Technician photos could not be loaded.");
  return loadPhotoEvidenceByRows(technicianId, (photoResult.data ?? []) as PhotoRow[]);
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
    .select("id, field_record_id, storage_path, capture_type, customer_visible, created_at")
    .eq("id", input.photoId)
    .maybeSingle();
  if (photoResult.error || !photoResult.data) throw new Error("Technician photo not found.");
  const current = (await loadPhotoEvidenceByRows(input.technicianId, [photoResult.data as PhotoRow]))[0];
  if (!current) throw new Error("That photo does not belong to this technician.");
  if (input.customerVisible && !current.memberLinked) {
    throw new Error("Link this Jobber property to a HomeAtlas member before publishing the photo.");
  }
  if (current.customerVisible === input.customerVisible) return current;

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
  const linksResult = await supabase
    .from("jobber_property_links")
    .select("connection_id, external_property_id")
    .eq("property_id", propertyId)
    .eq("link_state", "active");
  if (linksResult.error || !linksResult.data?.length) return [];

  const projectionIds: string[] = [];
  for (const link of linksResult.data as Array<{ connection_id: string; external_property_id: string }>) {
    const projectionResult = await supabase
      .from("jobber_visit_projections")
      .select("id")
      .eq("connection_id", link.connection_id)
      .eq("external_property_id", link.external_property_id)
      .order("scheduled_start", { ascending: false })
      .limit(100);
    if (!projectionResult.error) {
      projectionIds.push(...(projectionResult.data ?? []).map((row) => (row as { id: string }).id));
    }
  }
  if (!projectionIds.length) return [];
  const assignmentResult = await supabase
    .from("homeatlas_technician_visit_assignments")
    .select("id")
    .in("projection_id", [...new Set(projectionIds)]);
  if (assignmentResult.error || !assignmentResult.data?.length) return [];
  const assignmentIds = assignmentResult.data.map((row) => (row as { id: string }).id);
  const closeoutResult = await supabase
    .from("homeatlas_technician_job_closeouts")
    .select("field_record_id, technician_display_name, visit_date, created_at")
    .in("assignment_id", assignmentIds)
    .order("created_at", { ascending: false })
    .limit(100);
  if (closeoutResult.error || !closeoutResult.data?.length) return [];
  const closeoutByRecord = new Map(
    (closeoutResult.data as Array<{
      field_record_id: string;
      technician_display_name: string;
      visit_date: string;
      created_at: string;
    }>).map((row) => [row.field_record_id, row]),
  );
  const recordIds = [...closeoutByRecord.keys()];
  const photoResult = await supabase
    .from("homeatlas_technician_job_photos")
    .select("id, field_record_id, storage_path, capture_type, customer_visible, created_at")
    .in("field_record_id", recordIds)
    .eq("customer_visible", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (photoResult.error) return [];

  const mapped = await Promise.all(
    ((photoResult.data ?? []) as PhotoRow[]).map(async (photo): Promise<PropertyPhotoView | null> => {
      const closeout = closeoutByRecord.get(photo.field_record_id);
      if (!closeout) return null;
      const signed = await supabase.storage
        .from(VISIT_MEDIA_BUCKET)
        .createSignedUrl(photo.storage_path, 60 * 60);
      if (signed.error || !signed.data?.signedUrl) return null;
      return {
        id: `native-${photo.id}`,
        fieldRecordId: photo.field_record_id,
        source: "our_team",
        url: signed.data.signedUrl,
        caption:
          photo.capture_type === "after"
            ? "Finished result"
            : photo.capture_type === "before"
              ? "Before service"
              : "Service detail",
        isPrimary: false,
        uploadedAt: photo.created_at,
        captureType: photo.capture_type,
        capturedBy: closeout.technician_display_name,
      };
    }),
  );
  return mapped.filter((photo): photo is PropertyPhotoView => photo !== null);
}
