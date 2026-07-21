import "server-only";

import { createHash } from "node:crypto";
import type { HqActor } from "@/lib/auth/hq-access";
import type { JobberVisitSampleNode } from "./jobber-api";
import {
  fetchJobberCoverageWindow,
  hashCanonicalJobberVisit,
  JobberCoverageError,
  type JobberCoveragePage,
  type JobberCoverageWindow,
} from "./jobber-coverage-provider";
import { getFreshJobberAccessToken } from "./jobber-connection-store";
import { getJobberGraphqlVersion } from "./jobber-oauth-config";

const PACIFIC_TIME_ZONE = "America/Los_Angeles";
export const JOBBER_COVERAGE_BACK_DAYS = 90;
export const JOBBER_COVERAGE_FORWARD_DAYS = 365;
// Fourteen GraphQL requests plus at most one token refresh bounds provider wait
// to 225 seconds, leaving the configured 300-second route envelope for storage.
export const JOBBER_COVERAGE_MAX_REQUESTS = 14;
export const JOBBER_COVERAGE_MIN_WINDOW_MS = 1;

export type JobberCoverageFailureCode =
  | "concurrent_sync"
  | "duplicate_visit"
  | "graphql_partial_errors"
  | "http_429"
  | "http_error"
  | "malformed_response"
  | "malformed_timestamp"
  | "manifest_mismatch"
  | "query_cap_reached"
  | "storage_failure"
  | "timeout"
  | "unsplittable_saturation"
  | "version_mismatch"
  | "version_warning"
  | "watermark_conflict"
  | "window_violation";

export interface JobberCoverageObservation {
  externalVisitId: string;
  sourcePayloadHash: string;
  sourceObservedAt: string;
  visit: JobberVisitSampleNode;
}

export interface JobberCoverageLeaf {
  pass: 1 | 2;
  leafIndex: number;
  window: JobberCoverageWindow;
  observations: JobberCoverageObservation[];
  manifestSha256: string;
}

export interface JobberCoveragePassManifest {
  pass: 1 | 2;
  leaves: JobberCoverageLeaf[];
  manifestSha256: string;
  leafCoverageSha256: string;
  visitCount: number;
  requestCount: number;
}

export interface StartOrResumeJobberCoverageRunResult {
  outcome: "started" | "resumed" | "locked";
  runId: string;
  acquisitionGeneration: number | null;
  ownerToken: string | null;
  watermarkGeneration: number;
  window: JobberCoverageWindow;
  currentPass: 1 | 2;
  passReadyToComplete: boolean;
  requestCount: number;
  leafCount: number;
  visitCount: number;
}

export interface JobberCoverageOwnership {
  acquisitionGeneration: number;
  ownerToken: string;
}

export interface JobberCoverageReservedWork {
  outcome: "reserved";
  attemptId: string;
  pass: 1 | 2;
  partitionPath: string;
  window: JobberCoverageWindow;
}

export interface JobberCoveragePersistence {
  startOrResumeRun(input: {
    proposedRunId: string;
    actorId: string;
    proposedWindow: JobberCoverageWindow;
    graphqlVersion: string;
  }): Promise<StartOrResumeJobberCoverageRunResult>;
  reserveNextWork(input: {
    runId: string;
    actorId: string;
    ownership: JobberCoverageOwnership;
    attemptId: string;
  }): Promise<JobberCoverageReservedWork>;
  recordOverflow(input: {
    runId: string;
    actorId: string;
    ownership: JobberCoverageOwnership;
    work: JobberCoverageReservedWork;
    children: [JobberCoverageWindow, JobberCoverageWindow];
  }): Promise<void>;
  recordLeaf(input: {
    runId: string;
    actorId: string;
    ownership: JobberCoverageOwnership;
    work: JobberCoverageReservedWork;
    observations: JobberCoverageObservation[];
    manifestSha256: string;
  }): Promise<{ passReadyToComplete: boolean }>;
  loadPass(input: {
    runId: string;
    pass: 1 | 2;
  }): Promise<JobberCoveragePassManifest>;
  completePass(input: {
    runId: string;
    actorId: string;
    ownership: JobberCoverageOwnership;
    manifest: JobberCoveragePassManifest;
  }): Promise<"pass_two_ready" | "ready_to_finalize" | "replay">;
  pauseRun(input: {
    runId: string;
    actorId: string;
    ownership: JobberCoverageOwnership;
  }): Promise<void>;
  renewLease(input: {
    runId: string;
    actorId: string;
    ownership: JobberCoverageOwnership;
  }): Promise<void>;
  finalizeRun(input: {
    runId: string;
    actorId: string;
    ownership: JobberCoverageOwnership;
    expectedWatermarkGeneration: number;
  }): Promise<"completed" | "replay" | "unstable" | "watermark_conflict">;
  reconcileFinalization(input: {
    runId: string;
  }): Promise<"completed" | "not_completed">;
  markPartial(input: {
    runId: string;
    actorId: string;
    ownership: JobberCoverageOwnership;
    failureCode: JobberCoverageFailureCode;
    requestCount: number;
  }): Promise<void>;
}

export interface RunJobberCoverageSyncResult {
  outcome:
    | "complete"
    | "partial"
    | "concurrent"
    | "indeterminate"
    | "awaiting_continuation";
  runId: string;
  failureCode: JobberCoverageFailureCode | "finalization_indeterminate" | null;
  requestCount: number;
  leafCount: number;
  visitCount: number;
  window: JobberCoverageWindow;
}

class CoverageSyncFailure extends Error {
  constructor(public readonly code: JobberCoverageFailureCode) {
    super(code);
    this.name = "CoverageSyncFailure";
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function datePartsInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function pacificMidnightUtc(year: number, month: number, day: number): Date {
  const desiredLocalAsUtc = Date.UTC(year, month - 1, day);
  let guess = desiredLocalAsUtc;
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const observed = datePartsInTimeZone(new Date(guess), PACIFIC_TIME_ZONE);
    const observedLocalAsUtc = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second,
    );
    guess += desiredLocalAsUtc - observedLocalAsUtc;
  }
  return new Date(guess);
}

function addCalendarDays(
  date: { year: number; month: number; day: number },
  days: number,
) {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

export function fixedPacificCoverageWindow(now: Date): JobberCoverageWindow {
  if (!Number.isFinite(now.getTime())) throw new Error("Current time is invalid");
  const today = datePartsInTimeZone(now, PACIFIC_TIME_ZONE);
  const startDate = addCalendarDays(today, -JOBBER_COVERAGE_BACK_DAYS);
  // The end is exclusive, so add one day to include the full day 365 days
  // forward from the current Pacific date.
  const endDate = addCalendarDays(today, JOBBER_COVERAGE_FORWARD_DAYS + 1);
  return {
    startAt: pacificMidnightUtc(
      startDate.year,
      startDate.month,
      startDate.day,
    ).toISOString(),
    endAt: pacificMidnightUtc(
      endDate.year,
      endDate.month,
      endDate.day,
    ).toISOString(),
  };
}

export function splitCoverageWindow(
  window: JobberCoverageWindow,
  minimumWindowMs = JOBBER_COVERAGE_MIN_WINDOW_MS,
): [JobberCoverageWindow, JobberCoverageWindow] | null {
  const start = Date.parse(window.startAt);
  const end = Date.parse(window.endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new Error("Coverage window is invalid");
  }
  if (end - start <= minimumWindowMs) return null;
  const midpoint = start + Math.floor((end - start) / 2);
  if (midpoint <= start || midpoint >= end) return null;
  const split = new Date(midpoint).toISOString();
  return [
    { startAt: new Date(start).toISOString(), endAt: split },
    { startAt: split, endAt: new Date(end).toISOString() },
  ];
}

function observationManifest(observations: JobberCoverageObservation[]): string {
  return JSON.stringify(
    observations
      .map((observation) => [
        observation.externalVisitId,
        observation.sourcePayloadHash,
      ])
      .sort(([leftId], [rightId]) => leftId.localeCompare(rightId)),
  );
}

function leafCoverageManifest(leaves: JobberCoverageLeaf[]): string {
  return JSON.stringify(
    leaves
      .map((leaf) => ({
        startAt: leaf.window.startAt,
        endAt: leaf.window.endAt,
        observationCount: leaf.observations.length,
        manifestSha256: leaf.manifestSha256,
      }))
      .sort((left, right) => left.startAt.localeCompare(right.startAt)),
  );
}

export function buildJobberCoveragePassManifest(
  pass: 1 | 2,
  leaves: JobberCoverageLeaf[],
  requestCount: number,
): JobberCoveragePassManifest {
  const observations = leaves.flatMap((leaf) => leaf.observations);
  return {
    pass,
    leaves,
    manifestSha256: sha256(observationManifest(observations)),
    leafCoverageSha256: sha256(leafCoverageManifest(leaves)),
    visitCount: observations.length,
    requestCount,
  };
}

function providerFailureCode(error: unknown): JobberCoverageFailureCode {
  if (error instanceof CoverageSyncFailure) return error.code;
  if (error instanceof JobberCoverageError) return error.code;
  if (error instanceof Error && /\(429\)/.test(error.message)) return "http_429";
  if (error instanceof Error && /Jobber coverage query failed/.test(error.message)) {
    return "http_error";
  }
  return "storage_failure";
}

export async function crawlJobberCoveragePass(input: {
  pass: 1 | 2;
  accessToken: string;
  window: JobberCoverageWindow;
  requestBudget: { count: number; maximum: number };
  fetchWindow?: (
    accessToken: string,
    window: JobberCoverageWindow,
  ) => Promise<JobberCoveragePage>;
  observedAt?: () => string;
  minimumWindowMs?: number;
  persistLeaf?: (leaf: JobberCoverageLeaf) => Promise<void>;
  beforeRequest: () => Promise<void>;
}): Promise<JobberCoveragePassManifest> {
  const fetchWindow = input.fetchWindow ?? fetchJobberCoverageWindow;
  const observedAt = input.observedAt ?? (() => new Date().toISOString());
  const pending: JobberCoverageWindow[] = [input.window];
  const leaves: JobberCoverageLeaf[] = [];
  const observedIds = new Set<string>();
  const initialRequestCount = input.requestBudget.count;

  while (pending.length > 0) {
    const window = pending.shift()!;
    if (input.requestBudget.count >= input.requestBudget.maximum) {
      throw new CoverageSyncFailure("query_cap_reached");
    }
    // Fence every provider dispatch with durable ownership. The lease RPC
    // refuses expired or replaced runs, so a paused worker cannot resume calls.
    await input.beforeRequest();
    input.requestBudget.count += 1;
    const page = await fetchWindow(input.accessToken, window);

    if (page.hasNextPage) {
      const children = splitCoverageWindow(
        window,
        input.minimumWindowMs ?? JOBBER_COVERAGE_MIN_WINDOW_MS,
      );
      if (!children) {
        throw new CoverageSyncFailure("unsplittable_saturation");
      }
      pending.unshift(children[0], children[1]);
      continue;
    }

    const start = Date.parse(window.startAt);
    const end = Date.parse(window.endAt);
    const leafObservedAt = observedAt();
    const observations = page.nodes.map((visit) => {
      const visitStart = Date.parse(visit.startAt ?? "");
      if (!Number.isFinite(visitStart)) {
        throw new CoverageSyncFailure("malformed_timestamp");
      }
      if (visitStart < start || visitStart >= end) {
        throw new CoverageSyncFailure("window_violation");
      }
      if (observedIds.has(visit.id)) {
        throw new CoverageSyncFailure("duplicate_visit");
      }
      observedIds.add(visit.id);
      return {
        externalVisitId: visit.id,
        sourcePayloadHash: hashCanonicalJobberVisit(visit),
        sourceObservedAt: leafObservedAt,
        visit,
      };
    });
    const leaf: JobberCoverageLeaf = {
      pass: input.pass,
      leafIndex: leaves.length,
      window,
      observations,
      manifestSha256: sha256(observationManifest(observations)),
    };
    await input.persistLeaf?.(leaf);
    leaves.push(leaf);
  }

  return buildJobberCoveragePassManifest(
    input.pass,
    leaves,
    input.requestBudget.count - initialRequestCount,
  );
}

function manifestsMatch(
  first: JobberCoveragePassManifest,
  second: JobberCoveragePassManifest,
): boolean {
  return (
    first.manifestSha256 === second.manifestSha256 &&
    first.leafCoverageSha256 === second.leafCoverageSha256 &&
    first.visitCount === second.visitCount
  );
}

export async function runJobberCoverageSync(
  actor: HqActor,
  persistence: JobberCoveragePersistence,
  dependencies: {
    now?: () => Date;
    randomUuid?: () => string;
    randomAttemptUuid?: () => string;
    getAccessToken?: (
      beforeProviderRequest: () => Promise<void>,
    ) => Promise<string>;
    fetchWindow?: (
      accessToken: string,
      window: JobberCoverageWindow,
    ) => Promise<JobberCoveragePage>;
    maximumRequests?: number;
    minimumWindowMs?: number;
  } = {},
): Promise<RunJobberCoverageSyncResult> {
  const now = dependencies.now ?? (() => new Date());
  const proposedRunId = (dependencies.randomUuid ?? (() => crypto.randomUUID()))();
  const proposedWindow = fixedPacificCoverageWindow(now());
  const nextAttemptId = dependencies.randomAttemptUuid ?? (() => crypto.randomUUID());
  const maximumRequests =
    dependencies.maximumRequests ?? JOBBER_COVERAGE_MAX_REQUESTS;
  let runId = proposedRunId;
  let window = proposedWindow;
  let requestCount = 0;
  let leafCount = 0;
  let visitCount = 0;
  const indeterminateFinalization = (): RunJobberCoverageSyncResult => ({
    outcome: "indeterminate",
    runId,
    failureCode: "finalization_indeterminate",
    requestCount,
    leafCount,
    visitCount,
    window,
  });

  let start: StartOrResumeJobberCoverageRunResult;
  try {
    start = await persistence.startOrResumeRun({
      proposedRunId,
      actorId: actor.id,
      proposedWindow,
      graphqlVersion: getJobberGraphqlVersion(),
    });
  } catch {
    return {
      outcome: "partial",
      runId: proposedRunId,
      failureCode: "storage_failure",
      requestCount: 0,
      leafCount: 0,
      visitCount: 0,
      window: proposedWindow,
    };
  }
  runId = start.runId;
  window = start.window;
  requestCount = start.requestCount;
  leafCount = start.leafCount;
  visitCount = start.visitCount;
  if (start.outcome === "locked") {
    return {
      outcome: "concurrent",
      runId,
      failureCode: "concurrent_sync",
      requestCount,
      leafCount,
      visitCount,
      window,
    };
  }
  if (
    start.acquisitionGeneration === null ||
    start.acquisitionGeneration < 1 ||
    start.ownerToken === null
  ) {
    return {
      outcome: "partial",
      runId,
      failureCode: "storage_failure",
      requestCount,
      leafCount,
      visitCount,
      window,
    };
  }
  const ownership: JobberCoverageOwnership = {
    acquisitionGeneration: start.acquisitionGeneration,
    ownerToken: start.ownerToken,
  };

  let requestsThisInvocation = 0;
  let currentPass = start.currentPass;
  let passReadyToComplete = start.passReadyToComplete;
  let accessToken: string | null = null;
  let observedPass: 1 | 2 | null = null;
  let observedIds = new Set<string>();

  const loadObservedIds = async (pass: 1 | 2) => {
    if (observedPass === pass) return;
    const manifest = await persistence.loadPass({ runId, pass });
    observedIds = new Set(
      manifest.leaves.flatMap((leaf) =>
        leaf.observations.map((observation) => observation.externalVisitId),
      ),
    );
    observedPass = pass;
  };

  try {
    while (true) {
      if (passReadyToComplete) {
        const completedManifest = await persistence.loadPass({
          runId,
          pass: currentPass,
        });
        await persistence.completePass({
          runId,
          actorId: actor.id,
          ownership,
          manifest: completedManifest,
        });

        if (currentPass === 1) {
          currentPass = 2;
          passReadyToComplete = false;
          observedPass = null;
          observedIds = new Set();
          continue;
        }

        const firstManifest = await persistence.loadPass({ runId, pass: 1 });
        if (!manifestsMatch(firstManifest, completedManifest)) {
          throw new CoverageSyncFailure("manifest_mismatch");
        }

        let finalized: "completed" | "replay" | "unstable" | "watermark_conflict";
        try {
          finalized = await persistence.finalizeRun({
            runId,
            actorId: actor.id,
            ownership,
            expectedWatermarkGeneration: start.watermarkGeneration,
          });
        } catch {
          // The transaction may have committed even if its transport response
          // was lost. Resolve only from the exact durable run/watermark pair.
          let reconciled: "completed" | "not_completed";
          try {
            reconciled = await persistence.reconcileFinalization({ runId });
          } catch {
            return indeterminateFinalization();
          }
          if (reconciled !== "completed") return indeterminateFinalization();
          finalized = "replay";
        }
        if (finalized === "unstable") {
          throw new CoverageSyncFailure("manifest_mismatch");
        }
        if (finalized === "watermark_conflict") {
          throw new CoverageSyncFailure("watermark_conflict");
        }
        return {
          outcome: "complete",
          runId,
          failureCode: null,
          requestCount,
          leafCount,
          visitCount: completedManifest.visitCount,
          window,
        };
      }

      if (requestsThisInvocation >= maximumRequests) {
        try {
          await persistence.pauseRun({ runId, actorId: actor.id, ownership });
        } catch {
          // The pause transaction may have committed before its response was
          // lost. One exact idempotent replay resolves that ambiguity.
          await persistence.pauseRun({ runId, actorId: actor.id, ownership });
        }
        return {
          outcome: "awaiting_continuation",
          runId,
          failureCode: null,
          requestCount,
          leafCount,
          visitCount,
          window,
        };
      }

      if (accessToken === null) {
        accessToken = await (
          dependencies.getAccessToken ??
          ((beforeProviderRequest) =>
            getFreshJobberAccessToken({ beforeProviderRequest }))
        )(() => persistence.renewLease({ runId, actorId: actor.id, ownership }));
      }

      const work = await persistence.reserveNextWork({
        runId,
        actorId: actor.id,
        ownership,
        attemptId: nextAttemptId(),
      });
      if (work.pass !== currentPass) {
        throw new CoverageSyncFailure("storage_failure");
      }
      requestsThisInvocation += 1;
      requestCount += 1;
      const page = await (
        dependencies.fetchWindow ?? fetchJobberCoverageWindow
      )(accessToken, work.window);

      if (page.hasNextPage) {
        const children = splitCoverageWindow(
          work.window,
          dependencies.minimumWindowMs ?? JOBBER_COVERAGE_MIN_WINDOW_MS,
        );
        if (!children) {
          throw new CoverageSyncFailure("unsplittable_saturation");
        }
        await persistence.recordOverflow({
          runId,
          actorId: actor.id,
          ownership,
          work,
          children,
        });
        continue;
      }

      await loadObservedIds(currentPass);
      const startAt = Date.parse(work.window.startAt);
      const endAt = Date.parse(work.window.endAt);
      const sourceObservedAt = now().toISOString();
      const nextIds = new Set<string>();
      const observations = page.nodes.map((visit) => {
        const visitStart = Date.parse(visit.startAt ?? "");
        if (!Number.isFinite(visitStart)) {
          throw new CoverageSyncFailure("malformed_timestamp");
        }
        if (visitStart < startAt || visitStart >= endAt) {
          throw new CoverageSyncFailure("window_violation");
        }
        if (observedIds.has(visit.id) || nextIds.has(visit.id)) {
          throw new CoverageSyncFailure("duplicate_visit");
        }
        nextIds.add(visit.id);
        return {
          externalVisitId: visit.id,
          sourcePayloadHash: hashCanonicalJobberVisit(visit),
          sourceObservedAt,
          visit,
        };
      });
      const recorded = await persistence.recordLeaf({
        runId,
        actorId: actor.id,
        ownership,
        work,
        observations,
        manifestSha256: sha256(observationManifest(observations)),
      });
      for (const id of nextIds) observedIds.add(id);
      leafCount += 1;
      if (currentPass === 2) visitCount += observations.length;
      passReadyToComplete = recorded.passReadyToComplete;
    }
  } catch (error) {
    const failureCode = providerFailureCode(error);
    try {
      await persistence.markPartial({
        runId,
        actorId: actor.id,
        ownership,
        failureCode,
        requestCount,
      });
    } catch {
      return {
        outcome: "partial",
        runId,
        failureCode: "storage_failure",
        requestCount,
        leafCount,
        visitCount,
        window,
      };
    }
    return {
      outcome: "partial",
      runId,
      failureCode,
      requestCount,
      leafCount,
      visitCount,
      window,
    };
  }
}
