export interface JobberCoverageStatusView {
  coverageState: "complete" | "partial" | "stale";
  freshnessThresholdMinutes: 30;
  fresh: boolean;
  syncInProgress: boolean;
  awaitingContinuation: boolean;
  latestRun: {
    status: "running" | "awaiting_continuation" | "complete" | "partial";
    failureCode: string | null;
    visitCount: number;
    completedAt: string | null;
  } | null;
  inProgressRun: {
    runId: string;
    startedAt: string;
  } | null;
  continuationRun: {
    runId: string;
    requestCount: number;
    leafCount: number;
    visitCount: number;
    pausedAt: string;
  } | null;
  watermark: {
    windowStart: string;
    windowEnd: string;
    coveredAt: string;
    visitCount: number;
  } | null;
}

export interface JobberCoverageSyncResultView {
  outcome:
    | "complete"
    | "partial"
    | "concurrent"
    | "indeterminate"
    | "awaiting_continuation";
  failureCode: string | null;
  visitCount: number;
  error?: string;
}

export function jobberCoverageActionLabel(input: {
  refreshing: boolean;
  awaitingContinuation: boolean;
}): string {
  if (input.refreshing) return "Verifying schedule…";
  return input.awaitingContinuation
    ? "Continue Jobber verification"
    : "Refresh Jobber schedule";
}

export function jobberCoverageResultError(input: {
  httpStatus: number;
  result: JobberCoverageSyncResultView | null;
}): string | null {
  if (
    input.result?.outcome === "complete" ||
    input.result?.outcome === "awaiting_continuation"
  ) {
    return null;
  }
  if (input.httpStatus === 409 || input.result?.outcome === "concurrent") {
    return "A Jobber schedule refresh is already in progress.";
  }
  if (input.result?.outcome === "indeterminate") {
    return "The refresh result is not yet known. Check status before assuming either the prior or refreshed schedule is current.";
  }
  return input.result?.error ??
    "Coverage could not be proven. The previous complete schedule was left unchanged.";
}
