import "server-only";

import { createHash } from "crypto";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { fetchJobberVisitSample, type JobberVisitSampleNode } from "./jobber-api";
import { getFreshJobberAccessToken } from "./jobber-connection-store";
import { JOBBER_CONNECTION_ID } from "./jobber-oauth-config";

interface ExistingProjection {
  external_visit_id: string;
  source_payload_hash: string;
}

interface StoredProjectionPreviewRow {
  id: string;
  connection_id: string;
  external_visit_id: string;
  external_property_id: string;
  jobber_property_web_uri: string | null;
  title: string | null;
  client_name: string;
  visit_status: string;
  job_status: string | null;
  scheduled_start: string | null;
  completed_at: string | null;
  is_complete: boolean;
  source_payload_hash: string;
  source_observed_at: string;
  match_state: "manual_review" | "matched" | "ignored";
}

const PROJECTION_PREVIEW_SELECT =
  "id, connection_id, external_visit_id, external_property_id, jobber_property_web_uri, title, client_name, visit_status, job_status, scheduled_start, completed_at, is_complete, source_payload_hash, source_observed_at, match_state";

export interface JobberVisitProjectionPreview {
  projectionId: string;
  connectionId: string;
  externalVisitId: string;
  externalPropertyId: string;
  jobberPropertyWebUri: string | null;
  title: string | null;
  clientName: string;
  visitStatus: string;
  jobStatus: string | null;
  scheduledStart: string | null;
  completedAt: string | null;
  isComplete: boolean;
  sourcePayloadHash: string;
  sourceObservedAt: string;
  matchState: "manual_review" | "matched" | "ignored";
}

export interface JobberVisitSampleImportResult {
  requestedLimit: number;
  observed: number;
  inserted: number;
  changed: number;
  unchanged: number;
  hasNextPage: boolean;
  executionMode: "read_only";
  automaticMatching: false;
  visits: JobberVisitProjectionPreview[];
}

export function hashJobberVisitPayload(visit: JobberVisitSampleNode): string {
  return createHash("sha256").update(JSON.stringify(visit)).digest("hex");
}

export function toJobberVisitProjectionRow(
  visit: JobberVisitSampleNode,
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
    connectionId: row.connection_id,
    externalVisitId: row.external_visit_id,
    externalPropertyId: row.external_property_id,
    jobberPropertyWebUri: row.jobber_property_web_uri,
    title: row.title,
    clientName: row.client_name,
    visitStatus: row.visit_status,
    jobStatus: row.job_status,
    scheduledStart: row.scheduled_start,
    completedAt: row.completed_at,
    isComplete: row.is_complete,
    sourcePayloadHash: row.source_payload_hash,
    sourceObservedAt: row.source_observed_at,
    matchState: row.match_state,
  };
}

export async function importJobberVisitSample(
  limit = 5,
): Promise<JobberVisitSampleImportResult> {
  const accessToken = await getFreshJobberAccessToken();
  const sample = await fetchJobberVisitSample(accessToken, limit);
  const observedAt = new Date().toISOString();
  const rows = sample.nodes.map((visit) =>
    toJobberVisitProjectionRow(visit, observedAt),
  );
  const supabase = createServiceRoleSupabaseClient();
  const externalIds = rows.map((row) => row.external_visit_id);
  const existingResult = externalIds.length
    ? await supabase
        .from("jobber_visit_projections")
        .select("external_visit_id, source_payload_hash")
        .eq("connection_id", JOBBER_CONNECTION_ID)
        .in("external_visit_id", externalIds)
    : { data: [], error: null };
  if (existingResult.error) throw new Error(existingResult.error.message);
  const existing = new Map(
    ((existingResult.data ?? []) as ExistingProjection[]).map((row) => [
      row.external_visit_id,
      row.source_payload_hash,
    ]),
  );

  if (rows.length > 0) {
    const { error } = await supabase.from("jobber_visit_projections").upsert(rows, {
      onConflict: "connection_id,external_visit_id",
    });
    if (error) throw new Error(error.message);
  }

  let inserted = 0;
  let changed = 0;
  let unchanged = 0;
  for (const row of rows) {
    const previousHash = existing.get(row.external_visit_id);
    if (!previousHash) inserted += 1;
    else if (previousHash !== row.source_payload_hash) changed += 1;
    else unchanged += 1;
  }

  const storedResult = externalIds.length
    ? await supabase
        .from("jobber_visit_projections")
        .select(PROJECTION_PREVIEW_SELECT)
        .eq("connection_id", JOBBER_CONNECTION_ID)
        .in("external_visit_id", externalIds)
    : { data: [], error: null };
  if (storedResult.error) throw new Error(storedResult.error.message);

  return {
    requestedLimit: limit,
    observed: rows.length,
    inserted,
    changed,
    unchanged,
    hasNextPage: sample.pageInfo.hasNextPage,
    executionMode: "read_only",
    automaticMatching: false,
    visits: ((storedResult.data ?? []) as StoredProjectionPreviewRow[]).map(
      toProjectionPreview,
    ),
  };
}

export async function listJobberVisitSample(
  limit = 10,
  ascending = false,
): Promise<JobberVisitProjectionPreview[]> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("jobber_visit_projections")
    .select(PROJECTION_PREVIEW_SELECT)
    .eq("connection_id", JOBBER_CONNECTION_ID)
    .order("scheduled_start", { ascending })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as StoredProjectionPreviewRow[]).map(
    toProjectionPreview,
  );
}

export async function listJobberVisitReviewSample(
  limit: number,
  now = new Date(),
): Promise<JobberVisitProjectionPreview[]> {
  const supabase = createServiceRoleSupabaseClient();
  const futureResult = await supabase
    .from("jobber_visit_projections")
    .select(PROJECTION_PREVIEW_SELECT)
    .eq("connection_id", JOBBER_CONNECTION_ID)
    .eq("visit_status", "UPCOMING")
    .eq("is_complete", false)
    .is("completed_at", null)
    .gt("scheduled_start", now.toISOString())
    .order("scheduled_start", { ascending: true })
    .limit(limit);
  if (futureResult.error) throw new Error(futureResult.error.message);

  const futureRows = (futureResult.data ?? []) as StoredProjectionPreviewRow[];
  if (futureRows.length >= limit) {
    return futureRows.map(toProjectionPreview);
  }

  // Fill any remaining review capacity with the newest non-priority evidence.
  // Deduplication keeps the nearest future UPCOMING rows first even though the
  // fallback query may also return them.
  const fallbackResult = await supabase
    .from("jobber_visit_projections")
    .select(PROJECTION_PREVIEW_SELECT)
    .eq("connection_id", JOBBER_CONNECTION_ID)
    .order("scheduled_start", { ascending: false })
    .limit(limit);
  if (fallbackResult.error) throw new Error(fallbackResult.error.message);

  const rowsById = new Map(
    futureRows.map((row) => [row.id, row] as const),
  );
  for (const row of (fallbackResult.data ?? []) as StoredProjectionPreviewRow[]) {
    if (rowsById.size >= limit) break;
    rowsById.set(row.id, row);
  }
  return [...rowsById.values()].map(toProjectionPreview);
}
