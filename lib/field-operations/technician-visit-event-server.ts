import "server-only";

import { JOBBER_CONNECTION_ID } from "@/lib/care-operations/jobber-oauth-config";
import { chunkItems } from "@/lib/care-operations/jobber-sync-utils";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import type { FieldActor } from "./field-access";
import {
  buildTechnicianCustomerAlertDraft,
  isMissingTechnicianVisitEventSchema,
  resolveTechnicianVisitSnapshot,
  validateTechnicianVisitEventRequest,
  type TechnicianVisitEventRequest,
  type TechnicianVisitEventSnapshot,
  type TechnicianVisitEventSource,
  type TechnicianVisitEventType,
} from "./technician-visit-events";

interface StoredTechnicianVisitEventRow {
  appointment_id: string;
  event_type: TechnicianVisitEventType;
  occurred_at: string;
  actor_display_name: string;
}

interface AppointmentEventScopeRow {
  property_id: string;
  provider: string | null;
  external_id: string | null;
}

interface JobberVisitAlertContextRow {
  client_name: string;
  title: string | null;
}

interface TechnicianVisitEventRpcRow {
  event_id: string;
  event_type: TechnicianVisitEventType;
  occurred_at: string;
  customer_alert_prepared: boolean;
  replayed: boolean;
}

export interface RecordedTechnicianVisitEvent {
  eventId: string;
  eventType: TechnicianVisitEventType;
  occurredAt: string;
  customerAlertPrepared: boolean;
  replayed: boolean;
}

export async function loadTechnicianVisitEventSnapshots(
  appointmentIds: string[],
): Promise<{
  available: boolean;
  byAppointmentId: Map<string, TechnicianVisitEventSnapshot>;
}> {
  const uniqueAppointmentIds = [...new Set(appointmentIds)];
  const rows: StoredTechnicianVisitEventRow[] = [];
  const supabase = createServiceRoleSupabaseClient();

  for (const appointmentIdChunk of chunkItems(uniqueAppointmentIds)) {
    const result = await supabase
      .from("technician_visit_events")
      .select("appointment_id, event_type, occurred_at, actor_display_name")
      .in("appointment_id", appointmentIdChunk)
      .order("occurred_at", { ascending: true })
      .limit(2_000);
    if (result.error) {
      if (isMissingTechnicianVisitEventSchema(result.error)) {
        return { available: false, byAppointmentId: new Map() };
      }
      throw new Error(result.error.message);
    }
    rows.push(...((result.data ?? []) as StoredTechnicianVisitEventRow[]));
  }

  const rowsByAppointmentId = new Map<
    string,
    Array<{
      eventType: TechnicianVisitEventType;
      occurredAt: string;
      actorDisplayName: string;
    }>
  >();
  for (const row of rows) {
    const appointmentRows = rowsByAppointmentId.get(row.appointment_id) ?? [];
    appointmentRows.push({
      eventType: row.event_type,
      occurredAt: row.occurred_at,
      actorDisplayName: row.actor_display_name,
    });
    rowsByAppointmentId.set(row.appointment_id, appointmentRows);
  }

  return {
    available: true,
    byAppointmentId: new Map(
      [...rowsByAppointmentId].map(([appointmentId, events]) => [
        appointmentId,
        resolveTechnicianVisitSnapshot(events),
      ]),
    ),
  };
}

async function loadAlertContext(
  externalVisitId: string,
): Promise<JobberVisitAlertContextRow | null> {
  const supabase = createServiceRoleSupabaseClient();
  const result = await supabase
    .from("jobber_visit_projections")
    .select("client_name, title")
    .eq("connection_id", JOBBER_CONNECTION_ID)
    .eq("external_visit_id", externalVisitId)
    .maybeSingle();
  if (result.error || !result.data) return null;
  return result.data as JobberVisitAlertContextRow;
}

export async function recordTechnicianVisitEvent(input: {
  request: TechnicianVisitEventRequest;
  actor: FieldActor;
  source: TechnicianVisitEventSource;
}): Promise<RecordedTechnicianVisitEvent> {
  const validationError = validateTechnicianVisitEventRequest(input.request);
  if (validationError) throw new Error(validationError);
  if (input.source !== "field_action" && input.source !== "closeout") {
    throw new Error("Choose a valid technician route event source.");
  }

  const supabase = createServiceRoleSupabaseClient();
  const appointmentResult = await supabase
    .from("member_appointments")
    .select("property_id, provider, external_id")
    .eq("id", input.request.appointmentId)
    .maybeSingle();
  if (appointmentResult.error || !appointmentResult.data) {
    throw new Error("HomeAtlas appointment not found.");
  }
  const appointment = appointmentResult.data as AppointmentEventScopeRow;
  if (
    appointment.property_id !== input.request.propertyId ||
    appointment.provider !== "jobber" ||
    !appointment.external_id
  ) {
    throw new Error("The appointment is not a verified Jobber stop for this home.");
  }

  const alertContext = await loadAlertContext(appointment.external_id);
  const alertDraft = alertContext
    ? buildTechnicianCustomerAlertDraft({
        eventType: input.request.eventType,
        clientName: alertContext.client_name,
        serviceLabel: alertContext.title,
      })
    : null;
  const result = await supabase
    .rpc("record_technician_visit_event", {
      p_event_id: input.request.eventId,
      p_property_id: input.request.propertyId,
      p_appointment_id: input.request.appointmentId,
      p_grant_id: input.actor.grantId,
      p_jobber_user_id: input.actor.jobberUserId,
      p_actor_display_name: input.actor.displayName,
      p_actor_kind: input.actor.kind === "technician" ? "technician" : "hq",
      p_event_type: input.request.eventType,
      p_source: input.source,
      p_customer_alert_state: alertDraft ? "draft_only" : "not_applicable",
      p_customer_alert_draft: alertDraft,
    })
    .single();

  if (result.error || !result.data) {
    if (isMissingTechnicianVisitEventSchema(result.error)) {
      throw new Error(
        "Technician route automation is not ready. Apply migration 058.",
      );
    }
    throw new Error(result.error?.message ?? "Could not advance the field route.");
  }
  const row = result.data as TechnicianVisitEventRpcRow;
  return {
    eventId: row.event_id,
    eventType: row.event_type,
    occurredAt: row.occurred_at,
    customerAlertPrepared: Boolean(row.customer_alert_prepared),
    replayed: Boolean(row.replayed),
  };
}
