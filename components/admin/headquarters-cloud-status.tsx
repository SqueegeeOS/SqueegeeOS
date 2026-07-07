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
    <article className="border-t border-border/25 pt-8">
      <p className="text-[10px] uppercase tracking-[0.24em] text-muted/80">
        Cloud sync
      </p>
      <p className="mt-2 text-sm text-foreground/90">
        {synced ? "Synced to Supabase" : "Local only"}
      </p>

      <dl className="mt-4 space-y-3 text-xs text-muted">
        <div>
          <dt className="uppercase tracking-[0.16em]">Last synced</dt>
          <dd className="mt-1 text-foreground/90">
            {formatSyncedAt(baseline.updatedAt)}
          </dd>
        </div>
        <div>
          <dt className="uppercase tracking-[0.16em]">Founders</dt>
          <dd className="mt-1 text-foreground/90">{founders}</dd>
        </div>
      </dl>

      {sync.warning && (
        <p className="mt-3 text-xs text-amber-700/90">{sync.warning}</p>
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
