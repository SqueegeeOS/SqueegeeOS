import "server-only";

import {
  COMPANY_BUSINESS_TIMEZONE,
  formatBusinessCalendarDate,
  getBusinessCalendarDayUtcBounds,
} from "@/lib/admin/company-business-timezone";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { loadOpenVisitFieldFollowUps } from "@/lib/field-records/visit-field-follow-up-server";
import { readJobberConnectionStatus } from "./jobber-connection-store";
import { JOBBER_CONNECTION_ID } from "./jobber-oauth-config";
import { chunkItems } from "./jobber-sync-utils";
import type {
  JobberTodayAppointmentLink,
  JobberTodayData,
  JobberTodayPropertyLink,
  JobberTodayVisit,
} from "./jobber-today-types";
import { resolveJobberTodayHomeAtlasContext } from "./jobber-today-types";

interface StoredVisitRow {
  id: string;
  external_visit_id: string;
  external_client_id: string;
  external_property_id: string;
  jobber_property_web_uri: string | null;
  job_number: number | null;
  title: string | null;
  client_name: string;
  visit_status: string;
  job_status: string | null;
  scheduled_start: string;
  scheduled_end: string | null;
  is_complete: boolean;
}

interface StoredClientRow {
  external_client_id: string;
  jobber_web_uri: string;
  properties: unknown;
}

interface StoredClientProperty {
  id: string;
  name: string | null;
  jobberWebUri: string | null;
}

interface StoredPropertyLinkRow {
  external_property_id: string;
  property_id: string;
}

interface StoredAppointmentLinkRow {
  id: string;
  external_id: string;
  property_id: string;
}

const TODAY_VISIT_SELECT =
  "id, external_visit_id, external_client_id, external_property_id, jobber_property_web_uri, job_number, title, client_name, visit_status, job_status, scheduled_start, scheduled_end, is_complete";

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readClientProperties(value: unknown): StoredClientProperty[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const property = candidate as Record<string, unknown>;
    const id = optionalString(property.id);
    if (!id) return [];
    return [
      {
        id,
        name: optionalString(property.name),
        jobberWebUri: optionalString(property.jobberWebUri),
      },
    ];
  });
}

function toTodayVisit(
  row: StoredVisitRow,
  client: StoredClientRow | undefined,
  propertyLinks: JobberTodayPropertyLink[],
  appointmentLinks: JobberTodayAppointmentLink[],
): JobberTodayVisit {
  const property = readClientProperties(client?.properties).find(
    (candidate) => candidate.id === row.external_property_id,
  );
  const homeAtlas = resolveJobberTodayHomeAtlasContext({
    externalPropertyId: row.external_property_id,
    externalVisitId: row.external_visit_id,
    propertyLinks,
    appointmentLinks,
  });
  return {
    projectionId: row.id,
    externalVisitId: row.external_visit_id,
    clientName: row.client_name,
    title: row.title,
    jobNumber: row.job_number,
    visitStatus: row.visit_status,
    jobStatus: row.job_status,
    scheduledStart: row.scheduled_start,
    scheduledEnd: row.scheduled_end,
    isComplete: row.is_complete,
    propertyLabel: property?.name ?? null,
    jobberPropertyWebUri:
      row.jobber_property_web_uri ?? property?.jobberWebUri ?? null,
    jobberClientWebUri: client?.jobber_web_uri ?? null,
    ...homeAtlas,
  };
}

export async function loadJobberTodayBoard(
  reference: Date = new Date(),
): Promise<JobberTodayData> {
  const supabase = createServiceRoleSupabaseClient();
  const { startUtc, endUtc } = getBusinessCalendarDayUtcBounds(
    reference,
    COMPANY_BUSINESS_TIMEZONE,
  );

  const [connection, visitsResult, latestSyncResult, fieldFollowUps] =
    await Promise.all([
      readJobberConnectionStatus(),
      supabase
        .from("jobber_visit_projections")
        .select(TODAY_VISIT_SELECT)
        .eq("connection_id", JOBBER_CONNECTION_ID)
        .neq("visit_status", "REMOVED")
        .gte("scheduled_start", startUtc.toISOString())
        .lt("scheduled_start", endUtc.toISOString())
        .order("scheduled_start", { ascending: true })
        .limit(250),
      supabase
        .from("jobber_visit_projections")
        .select("source_observed_at")
        .eq("connection_id", JOBBER_CONNECTION_ID)
        .order("source_observed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      loadOpenVisitFieldFollowUps(),
    ]);

  if (visitsResult.error) throw new Error(visitsResult.error.message);
  if (latestSyncResult.error) throw new Error(latestSyncResult.error.message);

  const visitRows = (visitsResult.data ?? []) as StoredVisitRow[];
  const clientsById = new Map<string, StoredClientRow>();
  const externalClientIds = [
    ...new Set(visitRows.map((row) => row.external_client_id)),
  ];

  for (const clientIds of chunkItems(externalClientIds)) {
    const clientResult = await supabase
      .from("jobber_client_projections")
      .select("external_client_id, jobber_web_uri, properties")
      .eq("connection_id", JOBBER_CONNECTION_ID)
      .in("external_client_id", clientIds);
    if (clientResult.error) throw new Error(clientResult.error.message);
    for (const row of (clientResult.data ?? []) as StoredClientRow[]) {
      clientsById.set(row.external_client_id, row);
    }
  }

  const propertyLinks: JobberTodayPropertyLink[] = [];
  const externalPropertyIds = [
    ...new Set(visitRows.map((row) => row.external_property_id)),
  ];
  for (const propertyIds of chunkItems(externalPropertyIds)) {
    const linkResult = await supabase
      .from("jobber_property_links")
      .select("external_property_id, property_id")
      .eq("connection_id", JOBBER_CONNECTION_ID)
      .eq("link_state", "active")
      .in("external_property_id", propertyIds);
    if (linkResult.error) throw new Error(linkResult.error.message);
    propertyLinks.push(
      ...((linkResult.data ?? []) as StoredPropertyLinkRow[]).map((row) => ({
        externalPropertyId: row.external_property_id,
        propertyId: row.property_id,
      })),
    );
  }

  const appointmentLinks: JobberTodayAppointmentLink[] = [];
  const externalVisitIds = [
    ...new Set(visitRows.map((row) => row.external_visit_id)),
  ];
  for (const visitIds of chunkItems(externalVisitIds)) {
    const appointmentResult = await supabase
      .from("member_appointments")
      .select("id, external_id, property_id")
      .eq("provider", "jobber")
      .eq("verification_state", "verified")
      .eq("match_state", "matched")
      .in("external_id", visitIds);
    if (appointmentResult.error) throw new Error(appointmentResult.error.message);
    appointmentLinks.push(
      ...((appointmentResult.data ?? []) as StoredAppointmentLinkRow[]).map(
        (row) => ({
          externalVisitId: row.external_id,
          propertyId: row.property_id,
          appointmentId: row.id,
        }),
      ),
    );
  }

  const visits = visitRows.map((row) =>
    toTodayVisit(
      row,
      clientsById.get(row.external_client_id),
      propertyLinks,
      appointmentLinks,
    ),
  );
  const complete = visits.filter((visit) => visit.isComplete).length;
  const latestSync = latestSyncResult.data as {
    source_observed_at?: string;
  } | null;

  return {
    calendarDate: formatBusinessCalendarDate(
      reference,
      COMPANY_BUSINESS_TIMEZONE,
    ),
    timezone: COMPANY_BUSINESS_TIMEZONE,
    connected: connection.connected,
    connectionStatus: connection.status,
    accountName: connection.accountName,
    lastSyncedAt: latestSync?.source_observed_at ?? null,
    loadedAt: new Date().toISOString(),
    summary: {
      total: visits.length,
      complete,
      remaining: visits.length - complete,
    },
    visits,
    fieldFollowUps,
  };
}
