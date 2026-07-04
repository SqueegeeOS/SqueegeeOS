"use client";

import type { LegacyBaseline } from "@/lib/admin/legacy-baseline";

export function HeadquartersImportDraftBanner({
  cloudBaseline,
  localDraft,
  importing,
  onImport,
}: {
  cloudBaseline: LegacyBaseline;
  localDraft: LegacyBaseline;
  importing?: boolean;
  onImport: () => void;
}) {
  const cloudUpdated = cloudBaseline.updatedAt
    ? new Date(cloudBaseline.updatedAt).toLocaleString()
    : "unknown";
  const localUpdated = localDraft.updatedAt
    ? new Date(localDraft.updatedAt).toLocaleString()
    : "unknown";

  return (
    <div className="border-b border-amber-500/25 bg-amber-500/[0.06] px-5 py-4">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.22em] text-amber-700">
            Unsynced local draft
          </p>
          <p className="mt-1 text-sm text-foreground/90">
            This browser has a newer founder archive ({localUpdated}) than Cloud
            Headquarters ({cloudUpdated}). Supabase stays canonical unless you
            import this draft.
          </p>
        </div>
        <button
          type="button"
          onClick={onImport}
          disabled={importing}
          className="shrink-0 rounded-full border border-amber-500/35 px-5 py-2.5 text-[10px] uppercase tracking-[0.18em] text-amber-800 disabled:opacity-50"
        >
          {importing ? "Importing…" : "Import local draft"}
        </button>
      </div>
    </div>
  );
}
