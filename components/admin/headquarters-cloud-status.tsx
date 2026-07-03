"use client";

import type { HeadquartersProfileSource } from "@/lib/admin/headquarters-profile-client";

export function HeadquartersCloudStatus({
  source,
  cloudAvailable,
  warning,
}: {
  source: HeadquartersProfileSource;
  cloudAvailable: boolean;
  warning?: string;
}) {
  if (source === "supabase" || source === "migrated") {
    return (
      <span
        className="rounded-full border border-accent/30 bg-accent/[0.06] px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-accent"
        title={warning}
      >
        Cloud Headquarters
      </span>
    );
  }

  if (cloudAvailable) {
    return (
      <span className="rounded-full border border-border px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-muted">
        Cloud sync pending
      </span>
    );
  }

  return (
    <span
      className="rounded-full border border-border px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-muted"
      title={
        warning ??
        "Legacy archive stored on this device only. Connect Supabase to share across founders."
      }
    >
      Local archive only
    </span>
  );
}
