import "server-only";

import { createHash } from "crypto";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import {
  fetchAllJobberVisits,
  type JobberVisitNode,
} from "./jobber-api";
import { getFreshJobberAccessToken } from "./jobber-connection-store";
import { JOBBER_CONNECTION_ID } from "./jobber-oauth-config";
import {
  reconcileAllPairedCustomerPortalVisits,
  type JobberPortalReconciliationSummary,
} from "./jobber-portal-appointments";
import {
  buildSearchText,
  chunkItems,
  escapeLikePattern,
  summarizeProjectionChanges,
  toBoundedInteger,
} from "./jobber-sync-utils";

interface ExistingProjection {
  external_visit_id: string;
  source_payload_hash: string;
}

interface StoredProjectionPreviewRow {
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
  scheduled_start: string | null;
  is_complete: boolean;
  match_state: "manual_review" | "matched" | "ignored";
}

const PROJECTION_PREVIEW_SELECT =
  "id, external_visit_id, external_client_id, external_property_id, jobber_property_web_uri, job_number, title, client_name, visit_status, job_status, scheduled_start, is_complete, match_state";

export interface JobberVisitProjectionPreview {
  projectionId: string;
  externalVisitId: string;
  externalClientId: string;
  externalPropertyId: string;
  jobberPropertyWebUri: string | null;
  jobNumber: number | null;
  title: string | null;
  clientName: string;
  visitStatus: string;
  jobStatus: string | null;
  scheduledStart: string | null;
  isComplete: boolean;
  matchState: "manual_review" | "matched" | "ignored";
}

export interface JobberVisitSyncResult {
  observed: number;
  pagesRead: number;
  inserted: number;
  changed: number;
  unchanged: number;
  removed: number;
  cancelledPortalAppointments: number;
  executionMode: "read_only_sync";
  automaticMatching: false;
  portalAppointments: JobberPortalReconciliationSummary;
}

interface MissingProjectionRow {
  external_visit_id: string;
}

const MISSING_VISIT_STATUS = "REMOVED";

function missingVisitSnapshotHash(observedAt: string): string {
  return createHash("sha256")
    .update(`jobber-full-snapshot-missing:${observedAt}`)
    .digest("hex");
}

async function loadMissingProjectionIds(observedAt: string): Promise<string[]> {
  const supabase = createServiceRoleSupabaseClient();
  const pageSize = 500;
  const externalIds: string[] = [];

  for (let from = 0; ; from += pageSize) {
    const result = await supabase
      .from("jobber_visit_projections")
      .select("external_visit_id")
      .eq("connection_id", JOBBER_CONNECTION_ID)
      .lt("last_seen_at", observedAt)
      .neq("visit_status", MISSING_VISIT_STATUS)
      .order("external_visit_id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (result.error) throw new Error(result.error.message);
    const page = (result.data ?? []) as MissingProjectionRow[];
    externalIds.push(...page.map((row) => row.external_visit_id));
    if (page.length < pageSize) return externalIds;
  }
}

async function reconcileMissingJobberVisits(
  observedAt: string,
  observedCount: number,
): Promise<{ removed: number; cancelledPortalAppointments: number }> {
  // A surprising empty response is not enough evidence to cancel every visit.
  // Individual delete events and the next non-empty snapshot can still repair it.
  if (observedCount === 0) {
    return { removed: 0, cancelledPortalAppointments: 0 };
  }

  const externalIds = await loadMissingProjectionIds(observedAt);
  if (externalIds.length === 0) {
    return { removed: 0, cancelledPortalAppointments: 0 };
  }

  const supabase = createServiceRoleSupabaseClient();
  const tombstoneHash = missingVisitSnapshotHash(observedAt);
  let removed = 0;
  let cancelledPortalAppointments = 0;

  for (const batch of chunkItems(externalIds)) {
    const projections = await supabase
      .from("jobber_visit_projections")
      .update({
        visit_status: MISSING_VISIT_STATUS,
        is_complete: false,
        scheduled_start: null,
        scheduled_end: null,
        completed_at: null,
        source_payload_hash: tombstoneHash,
        source_observed_at: observedAt,
      })
      .eq("connection_id", JOBBER_CONNECTION_ID)
      .in("external_visit_id", batch)
      .neq("visit_status", MISSING_VISIT_STATUS)
      .select("external_visit_id");
    if (projections.error) throw new Error(projections.error.message);
    removed += projections.data?.length ?? 0;

    const appointments = await supabase
      .from("member_appointments")
      .update({
        status: "cancelled",
        completed_at: null,
        source_observed_at: observedAt,
        source_payload_hash: tombstoneHash,
      })
      .eq("provider", "jobber")
      .eq("status", "scheduled")
      .in("external_id", batch)
      .select("id");
    if (appointments.error) throw new Error(appointments.error.message);
    cancelledPortalAppointments += appointments.data?.length ?? 0;
  }

  return { removed, cancelledPortalAppointments };
}

export interface JobberVisitList {
  visits: JobberVisitProjectionPreview[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  search: string;
}

export function hashJobberVisitPayload(visit: JobberVisitNode): string {
  return createHash("sha256").update(JSON.stringify(visit)).digest("hex");
}

export function toJobberVisitProjectionRow(
  visit: JobberVisitNode,
  observedAt: string,
) {
  return {
    connection_id: JOBBER_CONNECTION_ID,
    provider: "jobber",
    external_visit_id: visit.id,
    external_job_id: visit.job.id,
    external_client_id: visit.client.id,
    external_property_id: visit.property.id,
    jobber_property_web_uri: visit.property.jobberWebUri,
    job_number: visit.job.jobNumber,
    title: visit.title ?? visit.job.title,
    client_name: visit.client.name,
    visit_status: visit.visitStatus,
    job_status: visit.job.jobStatus,
    is_complete: visit.isComplete,
    scheduled_start: visit.startAt,
    scheduled_end: visit.endAt,
    completed_at: visit.completedAt,
    raw_payload: visit,
    search_text: buildSearchText([
      visit.client.name,
      visit.title,
      visit.job.title,
      visit.visitStatus,
      visit.job.jobStatus,
      visit.job.jobNumber,
    ]),
    source_payload_hash: hashJobberVisitPayload(visit),
    source_observed_at: observedAt,
    last_seen_at: observedAt,
  };
}

function toProjectionPreview(
  row: StoredProjectionPreviewRow,
): JobberVisitProjectionPreview {
  return {
    projectionId: row.id,
    externalVisitId: row.external_visit_id,
    externalClientId: row.external_client_id,
    externalPropertyId: row.external_property_id,
    jobberPropertyWebUri: row.jobber_property_web_uri,
    jobNumber: row.job_number,
    title: row.title,
    clientName: row.client_name,
    visitStatus: row.visit_status,
    jobStatus: row.job_status,
    scheduledStart: row.scheduled_start,
    isComplete: row.is_complete,
    matchState: row.match_state,
  };
}

export async function syncAllJobberVisits(
  providedAccessToken?: string,
): Promise<JobberVisitSyncResult> {
  const accessToken = providedAccessToken ?? (await getFreshJobberAccessToken());
  const source = await fetchAllJobberVisits(accessToken);
  const observedAt = new Date().toISOString();
  const rows = source.nodes.map((visit) =>
    toJobberVisitProjectionRow(visit, observedAt),
  );
  const supabase = createServiceRoleSupabaseClient();
  const existing = new Map<string, string>();

  for (const externalIds of chunkItems(
    rows.map((row) => row.external_visit_id),
  )) {
    const result = await supabase
      .from("jobber_visit_projections")
      .select("external_visit_id, source_payload_hash")
      .eq("connection_id", JOBBER_CONNECTION_ID)
      .in("external_visit_id", externalIds);
    if (result.error) throw new Error(result.error.message);
    for (const row of (result.data ?? []) as ExistingProjection[]) {
      existing.set(row.external_visit_id, row.source_payload_hash);
    }
  }

  for (const batch of chunkItems(rows)) {
    const { error } = await supabase
      .from("jobber_visit_projections")
      .upsert(batch, { onConflict: "connection_id,external_visit_id" });
    if (error) throw new Error(error.message);
  }

  const missing = await reconcileMissingJobberVisits(observedAt, rows.length);

  const changes = summarizeProjectionChanges(
    rows.map((row) => ({
      externalId: row.external_visit_id,
      payloadHash: row.source_payload_hash,
    })),
    existing,
  );
  const portalAppointments = await reconcileAllPairedCustomerPortalVisits();

  return {
    observed: rows.length,
    pagesRead: source.pageCount,
    ...changes,
    ...missing,
    executionMode: "read_only_sync",
    automaticMatching: false,
    portalAppointments,
  };
}

export async function listJobberVisits(options: {
  search?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<JobberVisitList> {
  const search = options.search?.trim().slice(0, 120) ?? "";
  const page = toBoundedInteger(options.page, 1, 1, 100_000);
  const pageSize = toBoundedInteger(options.pageSize, 25, 1, 100);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const supabase = createServiceRoleSupabaseClient();
  let query = supabase
    .from("jobber_visit_projections")
    .select(PROJECTION_PREVIEW_SELECT, { count: "exact" })
    .eq("connection_id", JOBBER_CONNECTION_ID);

  if (search) {
    query = query.ilike("search_text", `%${escapeLikePattern(search)}%`);
  }

  const { data, count, error } = await query
    .order("scheduled_start", { ascending: false, nullsFirst: false })
    .range(from, to);
  if (error) throw new Error(error.message);
  const total = count ?? 0;

  return {
    visits: ((data ?? []) as StoredProjectionPreviewRow[]).map(
      toProjectionPreview,
    ),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    search,
  };
}
