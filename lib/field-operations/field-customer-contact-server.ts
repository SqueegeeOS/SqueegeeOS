import "server-only";

import { JOBBER_CONNECTION_ID } from "@/lib/care-operations/jobber-oauth-config";
import { chunkItems } from "@/lib/care-operations/jobber-sync-utils";
import type { JobberTodayVisit } from "@/lib/care-operations/jobber-today-types";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import type { FieldActor } from "./field-access";
import { jobberFieldCustomerPhones, type FieldCustomerPhone } from "./field-customer-phone";
import { TYLER_GERMANY_TECHNICIAN_ID } from "./technician-profile";

interface VisitContactKey {
  id: string;
  connection_id: string;
  provider: string;
  external_visit_id: string;
  external_client_id: string | null;
  external_property_id: string | null;
  visit_status: string;
  native_assignment: NativeAssignment | NativeAssignment[] | null;
}

interface NativeAssignment {
  id: string;
  connection_id: string;
  technician_id: string;
}

interface ClientContact {
  connection_id: string;
  provider: string;
  external_client_id: string;
  is_archived: boolean;
  phone: unknown;
  phones: unknown;
  properties: unknown;
}

function ownsJobberProperty(properties: unknown, propertyId: string): boolean {
  return Array.isArray(properties) && properties.some((property) =>
    property && typeof property === "object" && property.id === propertyId);
}

/** Only call on a field board already scoped to the authenticated actor. */
async function loadAssignedPhones(visits: JobberTodayVisit[]): Promise<Map<string, FieldCustomerPhone[]>> {
  const phones = new Map<string, FieldCustomerPhone[]>();
  const targets = new Map(visits.filter((visit) =>
    visit.homeAtlasAssignedTechnicianId === "homeatlas:" + TYLER_GERMANY_TECHNICIAN_ID &&
    visit.homeAtlasFieldAssignmentId && visit.visitStatus !== "REMOVED",
  ).map((visit) => [visit.projectionId, visit]));
  if (!targets.size) return phones;

  const supabase = createServiceRoleSupabaseClient();
  const keys: Array<{ id: string; client: string; property: string }> = [];
  for (const ids of chunkItems([...targets.keys()])) {
    // Recheck the native assignment with the visit in the same read. The
    // assignment can have changed since the field board was assembled.
    const { data, error } = await supabase.from("jobber_visit_projections")
      .select("id, connection_id, provider, external_visit_id, external_client_id, external_property_id, visit_status, native_assignment:homeatlas_technician_visit_assignments(id, connection_id, technician_id)")
      .eq("connection_id", JOBBER_CONNECTION_ID)
      .eq("provider", "jobber")
      .in("id", ids);
    if (error) throw new Error("jobber_visit_contact_unavailable");

    for (const row of (data ?? []) as unknown as VisitContactKey[]) {
      const visit = targets.get(row.id);
      const relation = row.native_assignment;
      const assignment = Array.isArray(relation) ? (relation.length === 1 ? relation[0] : null) : relation;
      if (visit && ids.includes(row.id) && row.connection_id === JOBBER_CONNECTION_ID &&
          row.provider === "jobber" && row.external_visit_id === visit.externalVisitId &&
          row.visit_status !== "REMOVED" && row.external_client_id && row.external_property_id &&
          assignment?.id === visit.homeAtlasFieldAssignmentId &&
          assignment.connection_id === JOBBER_CONNECTION_ID &&
          assignment.technician_id === TYLER_GERMANY_TECHNICIAN_ID) {
        keys.push({ id: row.id, client: row.external_client_id, property: row.external_property_id });
      }
    }
  }

  const clients = new Map<string, ClientContact | null>();
  for (const ids of chunkItems([...new Set(keys.map((key) => key.client))])) {
    const { data, error } = await supabase.from("jobber_client_projections")
      .select("connection_id, provider, external_client_id, is_archived, properties, phone, phones:raw_payload->phones")
      .eq("connection_id", JOBBER_CONNECTION_ID)
      .eq("provider", "jobber")
      .eq("is_archived", false)
      .in("external_client_id", ids);
    if (error) throw new Error("jobber_client_contact_unavailable");
    for (const row of (data ?? []) as ClientContact[]) {
      if (row.connection_id === JOBBER_CONNECTION_ID && row.provider === "jobber" &&
          row.is_archived === false && ids.includes(row.external_client_id)) {
        // The DB enforces a unique (connection, client) key. Fail closed if a
        // changed upstream projection ever contradicts that contract.
        clients.set(row.external_client_id, clients.has(row.external_client_id) ? null : row);
      }
    }
  }
  for (const key of keys) {
    const client = clients.get(key.client);
    if (client && ownsJobberProperty(client.properties, key.property)) {
      phones.set(key.id, jobberFieldCustomerPhones(client.phone, client.phones));
    }
  }
  return phones;
}

/** Private DTO enrichment only. A contact failure must not break the job board. */
export async function addFieldCustomerPhones(
  actor: FieldActor,
  visits: JobberTodayVisit[],
): Promise<JobberTodayVisit[]> {
  if (actor.kind !== "technician" || actor.jobberUserId !== "homeatlas:" + TYLER_GERMANY_TECHNICIAN_ID) return visits;
  const phones = await loadAssignedPhones(visits).catch(() => new Map<string, FieldCustomerPhone[]>());
  return visits.map((visit) => ({ ...visit, customerPhones: phones.get(visit.projectionId) ?? [] }));
}
