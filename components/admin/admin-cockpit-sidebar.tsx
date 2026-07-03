"use client";

import Link from "next/link";
import type { LegacyBaseline } from "@/lib/admin/legacy-baseline";
import { ROUTES } from "@/lib/navigation/config";
import { AdminBusinessHistory } from "./admin-business-history";
import { FounderJournal } from "./founder-journal";

interface AdminCockpitSidebarProps {
  legacyBaseline: LegacyBaseline;
}

export function AdminCockpitSidebar({
  legacyBaseline,
}: AdminCockpitSidebarProps) {
  return (
    <div className="space-y-6">
      <FounderJournal compact />
      <Link
        href={ROUTES.adminOurStory}
        className="block rounded-[1.75rem] border border-border/70 bg-surface/40 p-6 text-center transition-colors hover:border-accent/25 sm:p-7"
      >
        <p className="text-[10px] uppercase tracking-[0.24em] text-accent">
          Our Story
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          The living memory of SqueegeeKing — scroll back to the beginning.
        </p>
      </Link>
      <AdminBusinessHistory legacyBaseline={legacyBaseline} />
    </div>
  );
}
