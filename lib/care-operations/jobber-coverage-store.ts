import "server-only";

import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import {
  type BeginJobberCoverageRunResult,
  type JobberCoverageFailureCode,
  type JobberCoverageLeaf,
  type JobberCoveragePersistence,
} from "./jobber-coverage-sync";
import { JOBBER_CONNECTION_ID } from "./jobber-oauth-config";

const JOBBER_COVERAGE_FRESHNESS_MS = 30 * 60_000;

export function deriveJobberCoverageState(input: {
  latestRunId: string | null;
  latestRunStatus: "running" | "complete" | "partial" | null;
  watermarkRunId: string | null;
  coveredAt: string | null;
  now: Date;
}): { coverageState: "complete" | "partial" | "stale"; fresh: boolean } {
  const coveredAt = input.coveredAt ? Date.parse(input.coveredAt) : Number.NaN;
  const age = input.now.getTime() - coveredAt;
  const fresh =
    Number.isFinite(coveredAt) &&
    age >= 0 &&
    age <= JOBBER_COVERAGE_FRESHNESS_MS;
  const latestRunIsWatermark =
    input.latestRunId !== null &&
    input.latestRunId === input.watermarkRunId &&
    input.latestRunStatus === "complete";
  return {
    coverageState: input.latestRunStatus === "partial"
      ? "partial"
      : fresh && latestRunIsWatermark
        ? "complete"
        : "stale",
    fresh,
  };
}

interface RpcResult<T> {
  data: T | null;
  error: { message: string } | null;
}

interface CoverageRpcClient {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<RpcResult<unknown>>;
}

function rpcClient(): CoverageRpcClient {
  return createServiceRoleSupabaseClient() as unknown as CoverageRpcClient;
}

function assertRecord(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(message);
  }
  return value as Record<string, unknown>;
}

function leafRows(leaf: JobberCoverageLeaf) {
  return leaf.observations.map((observation) => {
    const visit = observation.visit;
    return {
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
      source_payload_hash: observation.sourcePayloadHash,
      source_observed_at: observation.sourceObservedAt,
    };
  });
}

export const jobberCoveragePersistence: JobberCoveragePersistence = {
  async beginRun(input): Promise<BeginJobberCoverageRunResult> {
    const { data, error } = await rpcClient().rpc(
      "begin_jobber_schedule_coverage_sync",
      {
        requested_run_id: input.runId,
        requested_connection_id: JOBBER_CONNECTION_ID,
        requested_actor_id: input.actorId,
        requested_window_start: input.window.startAt,
        requested_window_end: input.window.endAt,
        requested_graphql_version: input.graphqlVersion,
      },
    );
    if (error) throw new Error(error.message);
    const result = assertRecord(data, "Jobber sync reservation was malformed");
    if (result.outcome !== "acquired" && result.outcome !== "locked") {
      throw new Error("Jobber sync reservation returned an unknown outcome");
    }
    if (!Number.isInteger(result.watermark_generation)) {
      throw new Error("Jobber sync reservation omitted its watermark generation");
    }
    return {
      outcome: result.outcome,
      watermarkGeneration: result.watermark_generation as number,
    };
  },

  async appendLeaf({ runId, leaf }): Promise<void> {
    const { error } = await rpcClient().rpc(
      "append_jobber_schedule_coverage_leaf",
      {
        requested_run_id: runId,
        requested_pass: leaf.pass,
        requested_leaf_index: leaf.leafIndex,
        requested_window_start: leaf.window.startAt,
        requested_window_end: leaf.window.endAt,
        requested_manifest_sha256: leaf.manifestSha256,
        requested_observations: leafRows(leaf),
      },
    );
    if (error) throw new Error(error.message);
  },

  async completePass({ runId, manifest }): Promise<void> {
    const { error } = await rpcClient().rpc(
      "complete_jobber_schedule_coverage_pass",
      {
        requested_run_id: runId,
        requested_pass: manifest.pass,
        requested_manifest_sha256: manifest.manifestSha256,
        requested_leaf_coverage_sha256: manifest.leafCoverageSha256,
        requested_leaf_count: manifest.leaves.length,
        requested_visit_count: manifest.visitCount,
        requested_request_count: manifest.requestCount,
      },
    );
    if (error) throw new Error(error.message);
  },

  async renewLease({ runId }): Promise<void> {
    const { error } = await rpcClient().rpc(
      "renew_jobber_schedule_coverage_sync_lease",
      { requested_run_id: runId },
    );
    if (error) throw new Error(error.message);
  },

  async finalizeRun({
    runId,
    expectedWatermarkGeneration,
  }): Promise<"completed" | "replay" | "unstable" | "watermark_conflict"> {
    const { data, error } = await rpcClient().rpc(
      "finalize_jobber_schedule_coverage_sync",
      {
        requested_run_id: runId,
        requested_expected_watermark_generation: expectedWatermarkGeneration,
      },
    );
    if (error) throw new Error(error.message);
    if (
      data !== "completed" &&
      data !== "replay" &&
      data !== "unstable" &&
      data !== "watermark_conflict"
    ) {
      throw new Error("Jobber sync finalization returned an unknown outcome");
    }
    return data;
  },

  async reconcileFinalization({
    runId,
  }): Promise<"completed" | "not_completed"> {
    const { data, error } = await rpcClient().rpc(
      "reconcile_jobber_schedule_coverage_finalization",
      { requested_run_id: runId },
    );
    if (error) throw new Error(error.message);
    if (data !== "completed" && data !== "not_completed") {
      throw new Error("Jobber sync finalization reconciliation was malformed");
    }
    return data;
  },

  async markPartial({ runId, failureCode, requestCount }): Promise<void> {
    const { error } = await rpcClient().rpc(
      "mark_jobber_schedule_coverage_sync_partial",
      {
        requested_run_id: runId,
        requested_failure_code: failureCode,
        requested_request_count: requestCount,
      },
    );
    if (error) throw new Error(error.message);
  },
};

export interface StoredCoverageRun {
  id: string;
  reservation_sequence: number;
  status: "running" | "complete" | "partial";
  actor_id: string;
  graphql_version: string;
  window_start: string;
  window_end: string;
  failure_code: JobberCoverageFailureCode | null;
  request_count: number;
  leaf_count: number;
  visit_count: number;
  started_at: string;
  completed_at: string | null;
}

export interface StoredCoverageWatermark {
  run_id: string;
  window_start: string;
  window_end: string;
  covered_at: string;
  generation: number;
}

export interface StoredCoverageLock {
  active_run_id: string | null;
  lease_expires_at: string | null;
}

export interface JobberCoverageSyncStatus {
  coverageState: "complete" | "partial" | "stale";
  freshnessThresholdMinutes: 30;
  fresh: boolean;
  syncInProgress: boolean;
  latestRun: {
    runId: string;
    status: StoredCoverageRun["status"];
    actorId: string;
    graphqlVersion: string;
    windowStart: string;
    windowEnd: string;
    failureCode: JobberCoverageFailureCode | null;
    requestCount: number;
    leafCount: number;
    visitCount: number;
    startedAt: string;
    completedAt: string | null;
  } | null;
  inProgressRun: {
    runId: string;
    actorId: string;
    windowStart: string;
    windowEnd: string;
    requestCount: number;
    leafCount: number;
    visitCount: number;
    startedAt: string;
  } | null;
  watermark: {
    runId: string;
    windowStart: string;
    windowEnd: string;
    coveredAt: string;
    generation: number;
    visitCount: number;
    graphqlVersion: string;
  } | null;
}

function presentRun(run: StoredCoverageRun) {
  return {
    runId: run.id,
    status: run.status,
    actorId: run.actor_id,
    graphqlVersion: run.graphql_version,
    windowStart: run.window_start,
    windowEnd: run.window_end,
    failureCode: run.failure_code,
    requestCount: run.request_count,
    leafCount: run.leaf_count,
    visitCount: run.visit_count,
    startedAt: run.started_at,
    completedAt: run.completed_at,
  };
}

export function buildJobberCoverageSyncStatus(input: {
  latestRun: StoredCoverageRun | null;
  watermark: StoredCoverageWatermark | null;
  watermarkRun: StoredCoverageRun | null;
  lock: StoredCoverageLock | null;
  activeRun: StoredCoverageRun | null;
  now: Date;
}): JobberCoverageSyncStatus {
  const { latestRun, watermark, watermarkRun, lock, activeRun, now } = input;
  if (
    watermark &&
    (!watermarkRun ||
      watermarkRun.id !== watermark.run_id ||
      watermarkRun.status !== "complete")
  ) {
    throw new Error("Jobber coverage watermark run was inconsistent");
  }
  const lockIsCurrent = Boolean(
    lock?.active_run_id &&
      lock.lease_expires_at &&
      Date.parse(lock.lease_expires_at) > now.getTime(),
  );
  if (
    lockIsCurrent &&
    (!activeRun ||
      activeRun.id !== lock?.active_run_id ||
      activeRun.status !== "running")
  ) {
    throw new Error("Jobber coverage active run was inconsistent");
  }
  const derivedState = deriveJobberCoverageState({
    latestRunId: latestRun?.id ?? null,
    latestRunStatus: latestRun?.status ?? null,
    watermarkRunId: watermark?.run_id ?? null,
    coveredAt: watermark?.covered_at ?? null,
    now,
  });

  return {
    coverageState: derivedState.coverageState,
    freshnessThresholdMinutes: 30,
    fresh: derivedState.fresh,
    syncInProgress: lockIsCurrent,
    latestRun: latestRun ? presentRun(latestRun) : null,
    inProgressRun: lockIsCurrent && activeRun
      ? {
          runId: activeRun.id,
          actorId: activeRun.actor_id,
          windowStart: activeRun.window_start,
          windowEnd: activeRun.window_end,
          requestCount: activeRun.request_count,
          leafCount: activeRun.leaf_count,
          visitCount: activeRun.visit_count,
          startedAt: activeRun.started_at,
        }
      : null,
    watermark: watermark && watermarkRun
      ? {
          runId: watermark.run_id,
          windowStart: watermark.window_start,
          windowEnd: watermark.window_end,
          coveredAt: watermark.covered_at,
          generation: watermark.generation,
          visitCount: watermarkRun.visit_count,
          graphqlVersion: watermarkRun.graphql_version,
        }
      : null,
  };
}

export async function readJobberCoverageSyncStatus(
  now = new Date(),
): Promise<JobberCoverageSyncStatus> {
  const supabase = createServiceRoleSupabaseClient();
  const runColumns =
    "id, reservation_sequence, status, actor_id, graphql_version, window_start, window_end, failure_code, request_count, leaf_count, visit_count, started_at, completed_at";
  const [runResult, watermarkResult, lockResult] = await Promise.all([
    supabase
      .from("jobber_schedule_sync_runs")
      .select(runColumns)
      .eq("connection_id", JOBBER_CONNECTION_ID)
      .order("reservation_sequence", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("jobber_schedule_sync_watermarks")
      .select("run_id, window_start, window_end, covered_at, generation")
      .eq("connection_id", JOBBER_CONNECTION_ID)
      .maybeSingle(),
    supabase
      .from("jobber_schedule_sync_locks")
      .select("active_run_id, lease_expires_at")
      .eq("connection_id", JOBBER_CONNECTION_ID)
      .maybeSingle(),
  ]);
  for (const result of [runResult, watermarkResult, lockResult]) {
    if (result.error) throw new Error(result.error.message);
  }
  const run = runResult.data as StoredCoverageRun | null;
  const watermark = watermarkResult.data as StoredCoverageWatermark | null;
  const lock = lockResult.data as StoredCoverageLock | null;
  const activeRunId =
    lock?.active_run_id &&
    lock.lease_expires_at &&
    Date.parse(lock.lease_expires_at) > now.getTime()
      ? lock.active_run_id
      : null;
  const readRun = async (runId: string | null) => {
    if (!runId) return { data: null, error: null };
    return supabase
      .from("jobber_schedule_sync_runs")
      .select(runColumns)
      .eq("id", runId)
      .maybeSingle();
  };
  const [watermarkRunResult, activeRunResult] = await Promise.all([
    readRun(watermark?.run_id ?? null),
    readRun(activeRunId),
  ]);
  for (const result of [watermarkRunResult, activeRunResult]) {
    if (result.error) throw new Error(result.error.message);
  }

  return buildJobberCoverageSyncStatus({
    latestRun: run,
    watermark,
    watermarkRun: watermarkRunResult.data as StoredCoverageRun | null,
    lock,
    activeRun: activeRunResult.data as StoredCoverageRun | null,
    now,
  });
}
