"use client";

import { useCallback, useEffect, useState } from "react";

interface CoverageStatus {
  coverageState: "complete" | "partial" | "stale";
  freshnessThresholdMinutes: 30;
  fresh: boolean;
  syncInProgress: boolean;
  latestRun: {
    status: "running" | "complete" | "partial";
    failureCode: string | null;
    visitCount: number;
    completedAt: string | null;
  } | null;
  inProgressRun: {
    runId: string;
    startedAt: string;
  } | null;
  watermark: {
    windowStart: string;
    windowEnd: string;
    coveredAt: string;
    visitCount: number;
  } | null;
}

interface SyncResult {
  outcome: "complete" | "partial" | "concurrent" | "indeterminate";
  failureCode: string | null;
  visitCount: number;
  error?: string;
}

async function requestCoverageStatus(): Promise<CoverageStatus> {
  const response = await fetch(
    "/api/admin/care-operations/jobber/sync/status",
    { cache: "no-store" },
  );
  const body = (await response.json().catch(() => null)) as
    | (CoverageStatus & { error?: string })
    | null;
  if (!response.ok || !body) {
    throw new Error(body?.error ?? "Schedule coverage status is unavailable");
  }
  return body;
}

function formatCoveredAt(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const statePresentation = {
  complete: {
    label: "Complete",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  },
  partial: {
    label: "Partial",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  },
  stale: {
    label: "Stale",
    className: "border-border bg-foreground/[0.03] text-muted",
  },
} as const;

export function JobberScheduleSyncPanel() {
  const [status, setStatus] = useState<CoverageStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async (preserveError = false) => {
    setLoading(true);
    try {
      setStatus(await requestCoverageStatus());
      if (!preserveError) setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Schedule coverage status is unavailable",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    requestCoverageStatus()
      .then((nextStatus) => {
        if (!cancelled) {
          setStatus(nextStatus);
          setError(null);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Schedule coverage status is unavailable",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const response = await fetch(
        "/api/admin/care-operations/jobber/sync",
        { method: "POST" },
      );
      const body = (await response.json().catch(() => null)) as SyncResult | null;
      if (!response.ok || body?.outcome !== "complete") {
        if (response.status === 409 || body?.outcome === "concurrent") {
          throw new Error("A Jobber schedule refresh is already in progress.");
        }
        if (body?.outcome === "indeterminate") {
          throw new Error(
            "The refresh result is not yet known. Check status before assuming either the prior or refreshed schedule is current.",
          );
        }
        throw new Error(
          "Coverage could not be proven. The previous complete schedule was left unchanged.",
        );
      }
      window.dispatchEvent(new Event("jobber-schedule-refreshed"));
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Jobber schedule refresh did not complete",
      );
    } finally {
      await loadStatus(true);
      setRefreshing(false);
    }
  };

  const presentation = statePresentation[status?.coverageState ?? "stale"];
  return (
    <div className="mt-8 rounded-2xl border border-border/70 bg-foreground/[0.025] p-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted">
            Schedule coverage
          </p>
          <h3 className="mt-2 font-serif text-xl font-light text-foreground">
            Fixed-window Jobber schedule
          </h3>
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted">
            Reads 90 days back through 365 days forward, then verifies the same
            fixed window twice before updating HomeAtlas&apos;s Jobber-only view.
            It never changes Jobber or treats an absent visit as cancelled.
          </p>
        </div>
        <span
          className={`inline-flex self-start rounded-full border px-3 py-1.5 text-xs ${presentation.className}`}
        >
          {loading ? "Checking…" : presentation.label}
        </span>
      </div>

      <div className="mt-5 grid gap-3 text-xs text-muted sm:grid-cols-2">
        <p>
          {status?.coverageState === "complete" && status.watermark
            ? `Verified ${formatCoveredAt(status.watermark.coveredAt)} · ${status.watermark.visitCount} visits observed`
            : status?.coverageState === "partial"
              ? "The latest pass was incomplete. Its observations did not advance coverage."
              : "No complete coverage proof has been recorded in the last 30 minutes."}
        </p>
        <p className="sm:text-right">
          Freshness threshold · {status?.freshnessThresholdMinutes ?? 30} minutes
        </p>
      </div>

      {status?.inProgressRun ? (
        <p className="mt-3 text-xs text-muted" aria-live="polite">
          A newer refresh started {formatCoveredAt(status.inProgressRun.startedAt)}.
          The verified count above remains bound to the prior coverage watermark.
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading || refreshing || status?.syncInProgress === true}
          className="min-h-13 rounded-full border border-accent/40 bg-accent/10 px-5 py-3 text-sm text-accent transition hover:bg-accent/15 disabled:opacity-50"
        >
          {refreshing ? "Verifying schedule…" : "Refresh Jobber schedule"}
        </button>
        <button
          type="button"
          onClick={() => void loadStatus()}
          disabled={loading || refreshing}
          className="min-h-13 rounded-full border border-border px-5 py-3 text-sm text-muted transition hover:text-foreground disabled:opacity-50"
        >
          Check status
        </button>
      </div>
      {error ? (
        <p aria-live="polite" className="mt-4 text-xs text-amber-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
