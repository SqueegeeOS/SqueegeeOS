import "server-only";

import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import {
  buildJobberCoveragePassManifest,
  type JobberCoverageFailureCode,
  type JobberCoverageLeaf,
  type JobberCoverageObservation,
  type JobberCoveragePersistence,
  type JobberCoverageReservedWork,
  type StartOrResumeJobberCoverageRunResult,
} from "./jobber-coverage-sync";
import { parseJobberCoverageVisit } from "./jobber-coverage-provider";
import { JOBBER_CONNECTION_ID } from "./jobber-oauth-config";

const JOBBER_COVERAGE_FRESHNESS_MS = 30 * 60_000;

export function deriveJobberCoverageState(input: {
  latestRunId: string | null;
  latestRunStatus:
    | "running"
    | "awaiting_continuation"
    | "complete"
    | "partial"
    | null;
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

function requiredString(value: unknown, message: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(message);
  return value;
}

function requiredInteger(value: unknown, message: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) throw new Error(message);
  return value as number;
}

function requiredPositiveInteger(value: unknown, message: string): number {
  const result = requiredInteger(value, message);
  if (result < 1) throw new Error(message);
  return result;
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
  async startOrResumeRun(input): Promise<StartOrResumeJobberCoverageRunResult> {
    const { data, error } = await rpcClient().rpc(
      "start_or_resume_jobber_schedule_coverage_sync",
      {
        requested_proposed_run_id: input.proposedRunId,
        requested_connection_id: JOBBER_CONNECTION_ID,
        requested_actor_id: input.actorId,
        requested_window_start: input.proposedWindow.startAt,
        requested_window_end: input.proposedWindow.endAt,
        requested_graphql_version: input.graphqlVersion,
      },
    );
    if (error) throw new Error(error.message);
    const result = assertRecord(data, "Jobber sync reservation was malformed");
    if (
      result.outcome !== "started" &&
      result.outcome !== "resumed" &&
      result.outcome !== "locked"
    ) {
      throw new Error("Jobber sync reservation returned an unknown outcome");
    }
    if (result.current_pass !== 1 && result.current_pass !== 2) {
      throw new Error("Jobber sync reservation omitted its current pass");
    }
    if (typeof result.pass_ready_to_complete !== "boolean") {
      throw new Error("Jobber sync reservation omitted its frontier state");
    }
    return {
      outcome: result.outcome,
      runId: requiredString(result.run_id, "Jobber sync reservation omitted its run"),
      acquisitionGeneration:
        result.outcome === "locked"
          ? null
          : requiredPositiveInteger(
              result.acquisition_generation,
              "Jobber sync reservation omitted its acquisition generation",
            ),
      ownerToken:
        result.outcome === "locked"
          ? null
          : requiredString(
              result.owner_token,
              "Jobber sync reservation omitted its owner token",
            ),
      watermarkGeneration: requiredInteger(
        result.watermark_generation,
        "Jobber sync reservation omitted its watermark generation",
      ),
      window: {
        startAt: requiredString(
          result.window_start,
          "Jobber sync reservation omitted its window",
        ),
        endAt: requiredString(
          result.window_end,
          "Jobber sync reservation omitted its window",
        ),
      },
      currentPass: result.current_pass,
      passReadyToComplete: result.pass_ready_to_complete,
      requestCount: requiredInteger(
        result.request_count,
        "Jobber sync reservation omitted its request count",
      ),
      leafCount: requiredInteger(
        result.leaf_count,
        "Jobber sync reservation omitted its leaf count",
      ),
      visitCount: requiredInteger(
        result.visit_count,
        "Jobber sync reservation omitted its visit count",
      ),
    };
  },

  async reserveNextWork(input): Promise<JobberCoverageReservedWork> {
    const { data, error } = await rpcClient().rpc(
      "reserve_jobber_schedule_coverage_attempt",
      {
        requested_run_id: input.runId,
        requested_actor_id: input.actorId,
        requested_acquisition_generation: input.ownership.acquisitionGeneration,
        requested_owner_token: input.ownership.ownerToken,
        requested_attempt_id: input.attemptId,
      },
    );
    if (error) throw new Error(error.message);
    const result = assertRecord(data, "Jobber sync attempt reservation was malformed");
    if (result.outcome !== "reserved" || (result.pass_number !== 1 && result.pass_number !== 2)) {
      throw new Error("Jobber sync attempt reservation returned an unknown outcome");
    }
    return {
      outcome: "reserved",
      attemptId: requiredString(
        result.attempt_id,
        "Jobber sync attempt reservation omitted its id",
      ),
      pass: result.pass_number,
      partitionPath: requiredString(
        result.partition_path,
        "Jobber sync attempt reservation omitted its path",
      ),
      window: {
        startAt: requiredString(
          result.window_start,
          "Jobber sync attempt reservation omitted its window",
        ),
        endAt: requiredString(
          result.window_end,
          "Jobber sync attempt reservation omitted its window",
        ),
      },
    };
  },

  async recordOverflow({ runId, actorId, ownership, work, children }): Promise<void> {
    const { error } = await rpcClient().rpc(
      "record_jobber_schedule_coverage_overflow",
      {
        requested_run_id: runId,
        requested_actor_id: actorId,
        requested_acquisition_generation: ownership.acquisitionGeneration,
        requested_owner_token: ownership.ownerToken,
        requested_attempt_id: work.attemptId,
        requested_left_start: children[0].startAt,
        requested_left_end: children[0].endAt,
        requested_right_start: children[1].startAt,
        requested_right_end: children[1].endAt,
      },
    );
    if (error) throw new Error(error.message);
  },

  async recordLeaf({ runId, actorId, ownership, work, observations, manifestSha256 }) {
    const leaf: JobberCoverageLeaf = {
      pass: work.pass,
      leafIndex: 0,
      window: work.window,
      observations,
      manifestSha256,
    };
    const { data, error } = await rpcClient().rpc(
      "record_jobber_schedule_coverage_leaf",
      {
        requested_run_id: runId,
        requested_actor_id: actorId,
        requested_acquisition_generation: ownership.acquisitionGeneration,
        requested_owner_token: ownership.ownerToken,
        requested_attempt_id: work.attemptId,
        requested_manifest_sha256: manifestSha256,
        requested_observations: leafRows(leaf),
      },
    );
    if (error) throw new Error(error.message);
    const result = assertRecord(data, "Jobber sync leaf checkpoint was malformed");
    if (typeof result.pass_ready_to_complete !== "boolean") {
      throw new Error("Jobber sync leaf checkpoint omitted its frontier state");
    }
    return { passReadyToComplete: result.pass_ready_to_complete };
  },

  async loadPass({ runId, pass }) {
    const supabase = createServiceRoleSupabaseClient();
    const [partitionResult, observationResult, attemptResult] = await Promise.all([
      supabase
        .from("jobber_schedule_sync_partitions")
        .select("id, leaf_index, window_start, window_end, manifest_sha256")
        .eq("run_id", runId)
        .eq("pass_number", pass)
        .order("leaf_index", { ascending: true }),
      supabase
        .from("jobber_visit_source_observations")
        .select(
          "partition_id, external_visit_id, source_payload_hash, source_observed_at, source_payload",
        )
        .eq("run_id", runId)
        .eq("pass_number", pass),
      supabase
        .from("jobber_schedule_sync_request_attempts")
        .select("id")
        .eq("run_id", runId)
        .eq("pass_number", pass),
    ]);
    for (const result of [partitionResult, observationResult, attemptResult]) {
      if (result.error) throw new Error(result.error.message);
    }

    const observationRows = (observationResult.data ?? []) as Array<{
      partition_id: string;
      external_visit_id: string;
      source_payload_hash: string;
      source_observed_at: string;
      source_payload: unknown;
    }>;
    const observationsByPartition = new Map<string, JobberCoverageObservation[]>();
    for (const row of observationRows) {
      const payload = assertRecord(
        row.source_payload,
        "Stored Jobber coverage observation was malformed",
      );
      const observations = observationsByPartition.get(row.partition_id) ?? [];
      observations.push({
        externalVisitId: requiredString(
          row.external_visit_id,
          "Stored Jobber coverage observation omitted its visit",
        ),
        sourcePayloadHash: requiredString(
          row.source_payload_hash,
          "Stored Jobber coverage observation omitted its hash",
        ),
        sourceObservedAt: requiredString(
          row.source_observed_at,
          "Stored Jobber coverage observation omitted its timestamp",
        ),
        visit: parseJobberCoverageVisit(payload.raw_payload),
      });
      observationsByPartition.set(row.partition_id, observations);
    }

    const leaves = ((partitionResult.data ?? []) as Array<{
      id: string;
      leaf_index: number;
      window_start: string;
      window_end: string;
      manifest_sha256: string;
    }>).map((row) => ({
      pass,
      leafIndex: row.leaf_index,
      window: { startAt: row.window_start, endAt: row.window_end },
      observations: observationsByPartition.get(row.id) ?? [],
      manifestSha256: row.manifest_sha256,
    }));
    return buildJobberCoveragePassManifest(
      pass,
      leaves,
      (attemptResult.data ?? []).length,
    );
  },

  async completePass({ runId, actorId, ownership, manifest }) {
    const { data, error } = await rpcClient().rpc(
      "complete_resumable_jobber_schedule_coverage_pass",
      {
        requested_run_id: runId,
        requested_actor_id: actorId,
        requested_acquisition_generation: ownership.acquisitionGeneration,
        requested_owner_token: ownership.ownerToken,
        requested_pass: manifest.pass,
        requested_manifest_sha256: manifest.manifestSha256,
        requested_leaf_coverage_sha256: manifest.leafCoverageSha256,
        requested_leaf_count: manifest.leaves.length,
        requested_visit_count: manifest.visitCount,
        requested_request_count: manifest.requestCount,
      },
    );
    if (error) throw new Error(error.message);
    if (data !== "pass_two_ready" && data !== "ready_to_finalize" && data !== "replay") {
      throw new Error("Jobber sync pass completion returned an unknown outcome");
    }
    return data;
  },

  async pauseRun({ runId, actorId, ownership }): Promise<void> {
    const { error } = await rpcClient().rpc(
      "pause_jobber_schedule_coverage_sync",
      {
        requested_run_id: runId,
        requested_actor_id: actorId,
        requested_acquisition_generation: ownership.acquisitionGeneration,
        requested_owner_token: ownership.ownerToken,
      },
    );
    if (error) throw new Error(error.message);
  },

  async renewLease({ runId, actorId, ownership }): Promise<void> {
    const { error } = await rpcClient().rpc(
      "renew_resumable_jobber_schedule_coverage_sync_lease",
      {
        requested_run_id: runId,
        requested_actor_id: actorId,
        requested_acquisition_generation: ownership.acquisitionGeneration,
        requested_owner_token: ownership.ownerToken,
      },
    );
    if (error) throw new Error(error.message);
  },

  async finalizeRun({
    runId,
    actorId,
    ownership,
    expectedWatermarkGeneration,
  }): Promise<"completed" | "replay" | "unstable" | "watermark_conflict"> {
    const { data, error } = await rpcClient().rpc(
      "finalize_resumable_jobber_schedule_coverage_sync",
      {
        requested_run_id: runId,
        requested_actor_id: actorId,
        requested_acquisition_generation: ownership.acquisitionGeneration,
        requested_owner_token: ownership.ownerToken,
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

  async markPartial({
    runId,
    actorId,
    ownership,
    failureCode,
    requestCount,
  }): Promise<void> {
    const { error } = await rpcClient().rpc(
      "mark_resumable_jobber_schedule_coverage_sync_partial",
      {
        requested_run_id: runId,
        requested_actor_id: actorId,
        requested_acquisition_generation: ownership.acquisitionGeneration,
        requested_owner_token: ownership.ownerToken,
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
  status: "running" | "awaiting_continuation" | "complete" | "partial";
  actor_id: string;
  graphql_version: string;
  window_start: string;
  window_end: string;
  failure_code: JobberCoverageFailureCode | null;
  request_count: number;
  leaf_count: number;
  visit_count: number;
  started_at: string;
  continuation_paused_at: string | null;
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
  awaitingContinuation: boolean;
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
  continuationRun: {
    runId: string;
    actorId: string;
    windowStart: string;
    windowEnd: string;
    requestCount: number;
    leafCount: number;
    visitCount: number;
    startedAt: string;
    pausedAt: string;
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
    pausedAt: run.continuation_paused_at,
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
    awaitingContinuation: latestRun?.status === "awaiting_continuation",
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
    continuationRun:
      latestRun?.status === "awaiting_continuation" &&
      latestRun.continuation_paused_at
        ? {
            runId: latestRun.id,
            actorId: latestRun.actor_id,
            windowStart: latestRun.window_start,
            windowEnd: latestRun.window_end,
            requestCount: latestRun.request_count,
            leafCount: latestRun.leaf_count,
            visitCount: latestRun.visit_count,
            startedAt: latestRun.started_at,
            pausedAt: latestRun.continuation_paused_at,
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
    "id, reservation_sequence, status, actor_id, graphql_version, window_start, window_end, failure_code, request_count, leaf_count, visit_count, started_at, continuation_paused_at, completed_at";
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
