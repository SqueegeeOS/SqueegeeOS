"use client";

import { useEffect, useState } from "react";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";

interface VisitPreview {
  externalVisitId: string;
  title: string | null;
  clientName: string;
  visitStatus: string;
  scheduledStart: string | null;
  isComplete: boolean;
  matchState: "manual_review";
}

interface SampleResponse {
  executionMode: "read_only";
  automaticMatching: false;
  visits: VisitPreview[];
  observed?: number;
  inserted?: number;
  changed?: number;
  unchanged?: number;
  error?: string;
}

async function requestStoredSample(): Promise<SampleResponse> {
  const response = await fetch(
    "/api/admin/care-operations/jobber/visits/sample",
    { headers: getAdminRequestHeaders(), cache: "no-store" },
  );
  const body = (await response.json().catch(() => null)) as SampleResponse | null;
  if (!response.ok || !body) {
    throw new Error(body?.error ?? "Could not load the Jobber visit sample");
  }
  return body;
}

function formatVisitTime(value: string | null): string {
  if (!value) return "Unscheduled";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function JobberVisitSamplePanel() {
  const [sample, setSample] = useState<SampleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    requestStoredSample()
      .then((result) => {
        if (!cancelled) setSample(result);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load the Jobber visit sample",
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

  const importSample = async () => {
    setImporting(true);
    setError(null);
    try {
      const response = await fetch(
        "/api/admin/care-operations/jobber/visits/sample",
        {
          method: "POST",
          headers: getAdminRequestHeaders(),
          body: JSON.stringify({ limit: 5 }),
        },
      );
      const body = (await response.json().catch(() => null)) as
        | SampleResponse
        | null;
      if (!response.ok || !body) {
        throw new Error(body?.error ?? "Jobber sample import failed");
      }
      setSample(body);
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Jobber sample import failed",
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="mt-8 border-t border-border/70 pt-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted">
            Supervised sample
          </p>
          <h3 className="mt-2 font-serif text-xl font-light text-foreground">
            Observe five Jobber visits
          </h3>
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted">
            Read-only. Every visit remains unlinked and under manual review. It
            cannot appear in the portal, fulfill a promise, or become billable.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void importSample()}
          disabled={loading || importing}
          className="rounded-full border border-accent/40 bg-accent/10 px-5 py-3 text-sm text-accent transition hover:bg-accent/15 disabled:opacity-50"
        >
          {importing ? "Reading Jobber…" : "Import five read-only visits"}
        </button>
      </div>

      {sample?.observed !== undefined ? (
        <p className="mt-4 text-xs text-emerald-300">
          Observed {sample.observed} · New {sample.inserted ?? 0} · Changed{" "}
          {sample.changed ?? 0} · Unchanged {sample.unchanged ?? 0}
        </p>
      ) : null}
      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

      {sample?.visits.length ? (
        <div className="mt-5 space-y-2">
          {sample.visits.map((visit) => (
            <div
              key={visit.externalVisitId}
              className="grid gap-2 rounded-2xl border border-border/70 bg-black/10 p-4 sm:grid-cols-[1fr_auto]"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">
                  {visit.title || "Untitled visit"}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {visit.clientName} · {formatVisitTime(visit.scheduledStart)}
                </p>
              </div>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em]">
                <span className="rounded-full border border-border px-2.5 py-1 text-muted">
                  {visit.visitStatus}
                </span>
                <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-amber-300">
                  Manual review
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : loading ? (
        <p className="mt-5 text-xs text-muted">Checking stored samples…</p>
      ) : (
        <p className="mt-5 text-xs text-muted">No visits observed yet.</p>
      )}
    </div>
  );
}
