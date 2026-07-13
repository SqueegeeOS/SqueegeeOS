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

export interface JobberVisitProjectionPreview {
  externalVisitId: string;
  title: string | null;
  clientName: string;
  visitStatus: string;
  scheduledStart: string | null;
  isComplete: boolean;
  matchState: "manual_review";
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

function preview(visit: JobberVisitSampleNode): JobberVisitProjectionPreview {
  return {
    externalVisitId: visit.id,
    title: visit.title ?? visit.job.title,
    clientName: visit.client.name,
    visitStatus: visit.visitStatus,
    scheduledStart: visit.startAt,
    isComplete: visit.isComplete,
    matchState: "manual_review",
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

  return {
    requestedLimit: limit,
    observed: rows.length,
    inserted,
    changed,
    unchanged,
    hasNextPage: sample.pageInfo.hasNextPage,
    executionMode: "read_only",
    automaticMatching: false,
    visits: sample.nodes.map(preview),
  };
}

export async function listJobberVisitSample(): Promise<JobberVisitProjectionPreview[]> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("jobber_visit_projections")
    .select(
      "external_visit_id, title, client_name, visit_status, scheduled_start, is_complete, match_state",
    )
    .eq("connection_id", JOBBER_CONNECTION_ID)
    .order("scheduled_start", { ascending: false })
    .limit(10);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    externalVisitId: row.external_visit_id as string,
    title: (row.title as string | null) ?? null,
    clientName: row.client_name as string,
    visitStatus: row.visit_status as string,
    scheduledStart: (row.scheduled_start as string | null) ?? null,
    isComplete: Boolean(row.is_complete),
    matchState: "manual_review" as const,
  }));
}
