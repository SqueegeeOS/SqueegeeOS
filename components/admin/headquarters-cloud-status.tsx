"use client";

import type { HeadquartersSyncResult } from "@/lib/admin/headquarters-profile-client";
import type { LegacyBaseline } from "@/lib/admin/legacy-baseline";

function formatSyncedAt(updatedAt: string | null | undefined): string {
  if (!updatedAt) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(updatedAt));
  } catch {
    return updatedAt;
  }
}

export function HeadquartersStatusCard({
  sync,
  baseline,
}: {
  sync: HeadquartersSyncResult;
  baseline: LegacyBaseline;
}) {
  const synced =
    sync.source === "supabase" || sync.source === "migrated";
  const founders = baseline.founders?.join(" · ") ?? "—";

  return (
    <article className="rounded-[1.25rem] border border-border/70 bg-background/35 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-accent">
            Cloud Headquarters
          </p>
          <p className="mt-2 text-sm text-foreground/90">
            {synced ? "✓ Synced to Supabase" : "Not synced to Supabase"}
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${
            sync.databaseHealthy
              ? "border-accent/30 bg-accent/[0.06] text-accent"
              : "border-amber-500/30 bg-amber-500/[0.06] text-amber-700"
          }`}
        >
          {sync.databaseHealthy ? "Database healthy" : "Database issue"}
        </span>
      </div>

      <dl className="mt-4 grid gap-2 text-xs text-muted sm:grid-cols-2">
        <div>
          <dt className="uppercase tracking-[0.16em]">Last synced</dt>
          <dd className="mt-1 text-foreground/90">
            {formatSyncedAt(baseline.updatedAt)}
          </dd>
        </div>
        <div>
          <dt className="uppercase tracking-[0.16em]">Version</dt>
          <dd className="mt-1 break-all font-mono text-[11px] text-foreground/90">
            {baseline.updatedAt ?? "—"}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="uppercase tracking-[0.16em]">Founders</dt>
          <dd className="mt-1 text-foreground/90">{founders}</dd>
        </div>
      </dl>

      {sync.warning && (
        <p className="mt-3 text-xs text-amber-700">{sync.warning}</p>
      )}
    </article>
  );
}

/** Compact badge for top bar when full card is not shown. */
export function HeadquartersCloudStatus({
  sync,
}: {
  sync: HeadquartersSyncResult;
}) {
  const synced =
    sync.source === "supabase" || sync.source === "migrated";

  return (
    <span
      className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.22em] ${
        synced
          ? "border-accent/30 bg-accent/[0.06] text-accent"
          : "border-border text-muted"
      }`}
      title={sync.warning}
    >
      {synced ? "Cloud Headquarters" : "Cloud sync pending"}
    </span>
  );
}
