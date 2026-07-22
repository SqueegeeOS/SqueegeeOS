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
  | "version_unverified"
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

export interface BeginJobberCoverageRunResult {
  outcome: "acquired" | "locked";
  watermarkGeneration: number;
}

export interface JobberCoveragePersistence {
  beginRun(input: {
    runId: string;
    actorId: string;
    window: JobberCoverageWindow;
    graphqlVersion: string;
  }): Promise<BeginJobberCoverageRunResult>;
  appendLeaf(input: { runId: string; leaf: JobberCoverageLeaf }): Promise<void>;
  completePass(input: {
    runId: string;
    manifest: JobberCoveragePassManifest;
  }): Promise<void>;
  renewLease(input: { runId: string }): Promise<void>;
  finalizeRun(input: {
    runId: string;
    expectedWatermarkGeneration: number;
  }): Promise<"completed" | "replay" | "unstable" | "watermark_conflict">;
  reconcileFinalization(input: {
    runId: string;
  }): Promise<"completed" | "not_completed">;
  markPartial(input: {
    runId: string;
    failureCode: JobberCoverageFailureCode;
    requestCount: number;
  }): Promise<void>;
}

export interface RunJobberCoverageSyncResult {
  outcome: "complete" | "partial" | "concurrent" | "indeterminate";
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

function buildPassManifest(
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

  return buildPassManifest(
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
  const runId = (dependencies.randomUuid ?? (() => crypto.randomUUID()))();
  const window = fixedPacificCoverageWindow(now());
  const requestBudget = {
    count: 0,
    maximum: dependencies.maximumRequests ?? JOBBER_COVERAGE_MAX_REQUESTS,
  };
  let leafCount = 0;
  let visitCount = 0;
  const indeterminateFinalization = (): RunJobberCoverageSyncResult => ({
    outcome: "indeterminate",
    runId,
    failureCode: "finalization_indeterminate",
    requestCount: requestBudget.count,
    leafCount,
    visitCount,
    window,
  });

  let begin: BeginJobberCoverageRunResult;
  try {
    begin = await persistence.beginRun({
      runId,
      actorId: actor.id,
      window,
      graphqlVersion: getJobberGraphqlVersion(),
    });
  } catch {
    return {
      outcome: "partial",
      runId,
      failureCode: "storage_failure",
      requestCount: 0,
      leafCount: 0,
      visitCount: 0,
      window,
    };
  }
  if (begin.outcome === "locked") {
    return {
      outcome: "concurrent",
      runId,
      failureCode: "concurrent_sync",
      requestCount: 0,
      leafCount: 0,
      visitCount: 0,
      window,
    };
  }

  try {
    const accessToken = await (
      dependencies.getAccessToken ??
      ((beforeProviderRequest) =>
        getFreshJobberAccessToken({ beforeProviderRequest }))
    )(() => persistence.renewLease({ runId }));
    const crawl = (pass: 1 | 2) =>
      crawlJobberCoveragePass({
        pass,
        accessToken,
        window,
        requestBudget,
        fetchWindow: dependencies.fetchWindow,
        minimumWindowMs: dependencies.minimumWindowMs,
        beforeRequest: () => persistence.renewLease({ runId }),
        persistLeaf: async (leaf) => {
          await persistence.appendLeaf({ runId, leaf });
          leafCount += 1;
          if (pass === 2) visitCount += leaf.observations.length;
        },
      });

    const first = await crawl(1);
    await persistence.completePass({ runId, manifest: first });
    const second = await crawl(2);
    await persistence.completePass({ runId, manifest: second });
    if (!manifestsMatch(first, second)) {
      throw new CoverageSyncFailure("manifest_mismatch");
    }
    let finalized: "completed" | "replay" | "unstable" | "watermark_conflict";
    try {
      finalized = await persistence.finalizeRun({
        runId,
        expectedWatermarkGeneration: begin.watermarkGeneration,
      });
    } catch {
      // The transaction may have committed even if its transport response was
      // lost. Resolve only from the exact durable run/current-watermark pair.
      let reconciled: "completed" | "not_completed";
      try {
        reconciled = await persistence.reconcileFinalization({ runId });
      } catch {
        // Durable state is unknown: finalization may have committed, and the
        // exact-run read also has no response. Never rewrite or characterize
        // the run as partial from this worker.
        return indeterminateFinalization();
      }
      if (reconciled !== "completed") {
        // A not_completed read can race a transaction whose commit is not yet
        // visible. It is evidence only for that snapshot, not proof of rollback.
        // Status polling is the only later resolver of durable truth.
        return indeterminateFinalization();
      }
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
      requestCount: requestBudget.count,
      leafCount,
      visitCount,
      window,
    };
  } catch (error) {
    const failureCode = providerFailureCode(error);
    try {
      await persistence.markPartial({
        runId,
        failureCode,
        requestCount: requestBudget.count,
      });
    } catch {
      return {
        outcome: "partial",
        runId,
        failureCode: "storage_failure",
        requestCount: requestBudget.count,
        leafCount,
        visitCount,
        window,
      };
    }
    return {
      outcome: "partial",
      runId,
      failureCode,
      requestCount: requestBudget.count,
      leafCount,
      visitCount,
      window,
    };
  }
}
