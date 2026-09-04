import "server-only";

import {
  COMPANY_BUSINESS_TIMEZONE,
  formatBusinessCalendarDate,
  getBusinessCalendarDayUtcBounds,
} from "@/lib/admin/company-business-timezone";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { loadOpenVisitFieldFollowUps } from "@/lib/field-records/visit-field-follow-up-server";
import { loadTechnicianVisitEventSnapshots } from "@/lib/field-operations/technician-visit-event-server";
import type { TechnicianVisitEventSnapshot } from "@/lib/field-operations/technician-visit-events";
import { loadTechnicianJobClockSnapshots } from "@/lib/field-operations/technician-job-clock-server";
import {
  EMPTY_TECHNICIAN_JOB_CLOCK,
  type TechnicianJobClockSnapshot,
} from "@/lib/field-operations/technician-job-clock";
import { loadFieldIndependenceReviews } from "@/lib/field-operations/independence-review-server";
import type { FieldIndependenceReview } from "@/lib/field-operations/independence-review";
import {
  loadHomeAtlasFieldAssignments,
  loadHomeAtlasFieldExecution,
} from "@/lib/field-operations/homeatlas-field-assignment-server";
import type {
  HomeAtlasFieldAssignmentSnapshot,
  HomeAtlasFieldExecutionSnapshot,
} from "@/lib/field-operations/homeatlas-field-assignment";
import { readJobberConnectionStatus } from "./jobber-connection-store";
import { JOBBER_CONNECTION_ID } from "./jobber-oauth-config";
import { chunkItems } from "./jobber-sync-utils";
import {
  isMissingVisitFieldRecordSchema,
  summarizeJobberTodayFieldRecords,
  type JobberTodayFieldRecordRow,
  type JobberTodayFieldRecordSummary,
} from "./jobber-today-field-records";
import {
  buildJobberTodayPortalPath,
  isMissingMembershipPortalAccessSchema,
} from "./jobber-today-portal";
import type {
  JobberTodayAppointmentLink,
  JobberTodayData,
  JobberTodayPropertyLink,
  JobberTodayVisit,
} from "./jobber-today-types";
import {
  readJobberTodayVisitAssignment,
  readJobberTodayVisitScope,
  resolveJobberTodayHomeAtlasContext,
  summarizeJobberTodayVisits,
} from "./jobber-today-types";

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
  raw_payload: unknown;
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
  membership_id: string;
}

interface StoredMembershipPortalRow {
  id: string;
  portal_access_token: string | null;
}

interface StoredAppointmentLinkRow {
  id: string;
  external_id: string;
  property_id: string;
}

interface StoredFieldRecordRow {
  visit_id: string | null;
  field_record_id: string | null;
  technician_name: string;
  created_at: string;
  customer_note_visible: boolean;
  follow_up_status: string | null;
}

interface StoredVisibleAssetRow {
  field_record_id: string | null;
}

const TODAY_VISIT_SELECT =
  "id, external_visit_id, external_client_id, external_property_id, jobber_property_web_uri, job_number, title, client_name, visit_status, job_status, scheduled_start, scheduled_end, is_complete, raw_payload";

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

export function toTodayVisit(
  row: StoredVisitRow,
  client: StoredClientRow | undefined,
  propertyLinks: JobberTodayPropertyLink[],
  appointmentLinks: JobberTodayAppointmentLink[],
  fieldRecordsByAppointment: Map<string, JobberTodayFieldRecordSummary>,
  fieldEventsByAppointment: Map<string, TechnicianVisitEventSnapshot>,
  jobClocksByAppointment: Map<string, TechnicianJobClockSnapshot>,
  independenceReviewsByAppointment: Map<string, FieldIndependenceReview>,
  portalPathByMembershipId: Map<string, string>,
  fieldAssignmentsByVisit: Map<string, HomeAtlasFieldAssignmentSnapshot>,
  fieldExecutionByAssignment: Map<string, HomeAtlasFieldExecutionSnapshot>,
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
  const fieldRecord = homeAtlas.homeAtlasAppointmentId
    ? fieldRecordsByAppointment.get(homeAtlas.homeAtlasAppointmentId)
    : undefined;
  const fieldEvent = homeAtlas.homeAtlasAppointmentId
    ? fieldEventsByAppointment.get(homeAtlas.homeAtlasAppointmentId)
    : undefined;
  const jobClock = homeAtlas.homeAtlasAppointmentId
    ? jobClocksByAppointment.get(homeAtlas.homeAtlasAppointmentId)
    : undefined;
  const fieldAssignment = fieldAssignmentsByVisit.get(row.external_visit_id);
  const fieldExecution = fieldAssignment
    ? fieldExecutionByAssignment.get(fieldAssignment.id)
    : undefined;
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
    ...readJobberTodayVisitAssignment(row.raw_payload),
    ...readJobberTodayVisitScope(row.raw_payload),
    propertyLabel: property?.name ?? null,
    jobberPropertyWebUri:
      row.jobber_property_web_uri ?? property?.jobberWebUri ?? null,
    jobberClientWebUri: client?.jobber_web_uri ?? null,
    ...homeAtlas,
    homeAtlasFieldAssignmentId: fieldAssignment?.id ?? null,
    homeAtlasAssignedTechnicianId:
      fieldAssignment?.technicianIdentityKey ?? null,
    homeAtlasAssignedTechnicianName:
      fieldAssignment?.technicianDisplayName ?? null,
    homeAtlasPortalPath: homeAtlas.homeAtlasMembershipId
      ? (portalPathByMembershipId.get(homeAtlas.homeAtlasMembershipId) ?? null)
      : null,
    homeAtlasFieldRecordCount:
      fieldAssignment ? fieldExecution?.fieldRecordCount ?? 0 : fieldRecord?.count ?? 0,
    homeAtlasLatestFieldRecordAt:
      fieldAssignment ? fieldExecution?.latestFieldRecordAt ?? null : fieldRecord?.latestFieldRecordAt ?? null,
    homeAtlasLatestFieldRecordBy:
      fieldAssignment ? fieldExecution?.latestFieldRecordBy ?? null : fieldRecord?.latestTechnicianName ?? null,
    homeAtlasCustomerVisibleRecordCount:
      fieldRecord?.customerVisibleCount ?? 0,
    homeAtlasOpenFollowUpCount:
      (fieldRecord?.openFollowUpCount ?? 0) + (fieldExecution?.openFollowUpCount ?? 0),
    homeAtlasFieldCustomerSummary: fieldExecution?.customerSummary ?? null,
    homeAtlasFieldInternalNote: fieldExecution?.internalNote ?? null,
    homeAtlasFieldScopeException: fieldExecution?.scopeException ?? null,
    homeAtlasFieldPhotoCount: fieldExecution?.photoCount ?? 0,
    homeAtlasFieldStage: fieldAssignment ? (
      fieldExecution?.clock.state === "finished"
        ? "departed"
        : fieldExecution?.fieldRecordCount
          ? "service_completed"
          : fieldExecution?.clock.state === "running"
            ? "service_started"
            : "not_started"
    ) : fieldEvent?.stage ?? "not_started",
    homeAtlasFieldStageAt:
      fieldAssignment ? fieldExecution?.clock.endedAt ?? fieldExecution?.latestFieldRecordAt ?? fieldExecution?.clock.startedAt ?? null : fieldEvent?.occurredAt ?? null,
    homeAtlasFieldStageBy:
      fieldAssignment ? fieldExecution?.clock.finishedByDisplayName ?? fieldExecution?.latestFieldRecordBy ?? fieldExecution?.clock.startedByDisplayName ?? null : fieldEvent?.actorDisplayName ?? null,
    homeAtlasFieldEventCount: fieldEvent?.eventCount ?? 0,
    homeAtlasJobClock: fieldAssignment ? fieldExecution?.clock ?? EMPTY_TECHNICIAN_JOB_CLOCK : jobClock ?? EMPTY_TECHNICIAN_JOB_CLOCK,
    homeAtlasIndependenceReview: homeAtlas.homeAtlasAppointmentId
      ? (independenceReviewsByAppointment.get(
          homeAtlas.homeAtlasAppointmentId,
        ) ?? null)
      : null,
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
      .select("external_property_id, property_id, membership_id")
      .eq("connection_id", JOBBER_CONNECTION_ID)
      .eq("link_state", "active")
      .in("external_property_id", propertyIds);
    if (linkResult.error) throw new Error(linkResult.error.message);
    propertyLinks.push(
      ...((linkResult.data ?? []) as StoredPropertyLinkRow[]).map((row) => ({
        externalPropertyId: row.external_property_id,
        propertyId: row.property_id,
        membershipId: row.membership_id,
      })),
    );
  }

  const portalPathByMembershipId = new Map<string, string>();
  const membershipIds = [
    ...new Set(propertyLinks.map((link) => link.membershipId)),
  ];
  for (const membershipIdChunk of chunkItems(membershipIds)) {
    const portalResult = await supabase
      .from("memberships")
      .select("id, portal_access_token")
      .in("id", membershipIdChunk);
    if (portalResult.error) {
      if (isMissingMembershipPortalAccessSchema(portalResult.error)) {
        portalPathByMembershipId.clear();
        break;
      }
      throw new Error(portalResult.error.message);
    }
    for (const row of (portalResult.data ?? []) as StoredMembershipPortalRow[]) {
      const portalPath = buildJobberTodayPortalPath(row.portal_access_token);
      if (portalPath) portalPathByMembershipId.set(row.id, portalPath);
    }
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

  const fieldAssignments = await loadHomeAtlasFieldAssignments(externalVisitIds);
  const fieldExecution = await loadHomeAtlasFieldExecution(
    [...fieldAssignments.byExternalVisitId.values()].map((assignment) => assignment.id),
  );

  const storedFieldRecordRows: StoredFieldRecordRow[] = [];
  let fieldRecordStatusAvailable = true;
  const appointmentIds = appointmentLinks.map((link) => link.appointmentId);
  for (const appointmentIdChunk of chunkItems(appointmentIds)) {
    const fieldRecordResult = await supabase
      .from("property_assessments")
      .select(
        "visit_id, field_record_id, technician_name, created_at, customer_note_visible, follow_up_status",
      )
      .in("visit_id", appointmentIdChunk)
      .not("field_record_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(2_000);
    if (fieldRecordResult.error) {
      if (isMissingVisitFieldRecordSchema(fieldRecordResult.error)) {
        fieldRecordStatusAvailable = false;
        storedFieldRecordRows.length = 0;
        break;
      }
      throw new Error(fieldRecordResult.error.message);
    }
    storedFieldRecordRows.push(
      ...((fieldRecordResult.data ?? []) as StoredFieldRecordRow[]),
    );
  }

  const visiblePhotoFieldRecordIds = new Set<string>();
  const fieldRecordIds = [
    ...new Set(
      storedFieldRecordRows.flatMap((row) =>
        row.field_record_id ? [row.field_record_id] : [],
      ),
    ),
  ];
  if (fieldRecordStatusAvailable) {
    for (const fieldRecordIdChunk of chunkItems(fieldRecordIds)) {
      const visibleAssetResult = await supabase
        .from("property_assets")
        .select("field_record_id")
        .in("field_record_id", fieldRecordIdChunk)
        .eq("customer_visible", true)
        .limit(2_000);
      if (visibleAssetResult.error) {
        if (isMissingVisitFieldRecordSchema(visibleAssetResult.error)) {
          fieldRecordStatusAvailable = false;
          storedFieldRecordRows.length = 0;
          visiblePhotoFieldRecordIds.clear();
          break;
        }
        throw new Error(visibleAssetResult.error.message);
      }
      for (const row of (visibleAssetResult.data ?? []) as StoredVisibleAssetRow[]) {
        if (row.field_record_id) visiblePhotoFieldRecordIds.add(row.field_record_id);
      }
    }
  }

  const fieldRecordRows: JobberTodayFieldRecordRow[] =
    storedFieldRecordRows.map((row) => ({
      appointmentId: row.visit_id,
      fieldRecordId: row.field_record_id,
      technicianName: row.technician_name,
      createdAt: row.created_at,
      customerVisible:
        row.customer_note_visible ||
        (row.field_record_id
          ? visiblePhotoFieldRecordIds.has(row.field_record_id)
          : false),
      followUpOpen: row.follow_up_status === "open",
    }));
  const fieldRecordsByAppointment =
    summarizeJobberTodayFieldRecords(fieldRecordRows);
  const [fieldEvents, jobClocks, independenceReviews] = await Promise.all([
    loadTechnicianVisitEventSnapshots(appointmentIds),
    loadTechnicianJobClockSnapshots(appointmentIds),
    loadFieldIndependenceReviews(appointmentIds),
  ]);

  const visits = visitRows.map((row) =>
    toTodayVisit(
      row,
      clientsById.get(row.external_client_id),
      propertyLinks,
      appointmentLinks,
      fieldRecordsByAppointment,
      fieldEvents.byAppointmentId,
      jobClocks.byAppointmentId,
      independenceReviews.byAppointmentId,
      portalPathByMembershipId,
      fieldAssignments.byExternalVisitId,
      fieldExecution.byAssignmentId,
    ),
  );
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
    fieldRecordStatusAvailable:
      fieldRecordStatusAvailable && fieldExecution.available,
    fieldEventStatusAvailable: fieldEvents.available,
    jobClockStatusAvailable:
      jobClocks.available && fieldExecution.available,
    independenceReviewStatusAvailable: independenceReviews.available,
    summary: summarizeJobberTodayVisits(visits),
    visits,
    fieldFollowUps,
  };
}
