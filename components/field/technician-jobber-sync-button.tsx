"use client";

import { useState } from "react";

interface FieldJobberSyncResponse {
  ok?: boolean;
  syncedAt?: string;
  insertedVisits?: number;
  changedVisits?: number;
  reconciledLiveJobs?: number;
  warning?: string | null;
  error?: string;
}

function timeLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function TechnicianJobberSyncButton() {
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function syncJobber() {
    if (syncing) return;
    setSyncing(true);
    setNotice(null);
    setError(null);

    try {
      const response = await fetch("/api/field/jobber-sync", {
        method: "POST",
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as
        | FieldJobberSyncResponse
        | null;
      if (!response.ok || !body?.ok) {
        throw new Error(body?.error ?? "Could not refresh Jobber.");
      }

      const changed = (body.insertedVisits ?? 0) + (body.changedVisits ?? 0);
      const synced = timeLabel(body.syncedAt);
      setNotice(
        changed > 0
          ? `Jobber updated${synced ? ` at ${synced}` : ""} · ${changed} route change${changed === 1 ? "" : "s"} found.`
          : `Jobber checked${synced ? ` at ${synced}` : ""} · route is current.`,
      );
      window.setTimeout(() => window.location.reload(), 450);
    } catch (syncError) {
      setError(
        syncError instanceof Error
          ? syncError.message
          : "Could not refresh Jobber.",
      );
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="fixed bottom-[max(1rem,var(--safe-area-bottom))] right-4 z-[75] flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2 sm:right-6">
      {notice ? (
        <p
          role="status"
          className="max-w-sm rounded-2xl border border-success/25 bg-[#0b0a09]/95 px-4 py-3 text-xs leading-relaxed text-success shadow-xl backdrop-blur-xl"
        >
          {notice}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="max-w-sm rounded-2xl border border-warning/25 bg-[#0b0a09]/95 px-4 py-3 text-xs leading-relaxed text-warning shadow-xl backdrop-blur-xl"
        >
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => void syncJobber()}
        disabled={syncing}
        className="inline-flex min-h-12 items-center rounded-full border border-accent/30 bg-accent px-5 text-xs font-semibold text-background shadow-[0_18px_60px_rgba(0,0,0,.45)] active:scale-[0.98] disabled:opacity-60"
      >
        {syncing ? "Syncing Jobber…" : "Sync Jobber"}
      </button>
    </div>
  );
}
