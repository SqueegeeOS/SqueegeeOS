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
    <div className="space-y-10">
      <FounderJournal compact />
      <Link
        href={ROUTES.hqOurStory}
        className="block border-t border-border/25 pt-8 transition-colors hover:text-foreground"
      >
        <p className="text-[10px] uppercase tracking-[0.24em] text-muted/80">
          Our Story
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          The living memory of SqueegeeKing.
        </p>
      </Link>
      <AdminBusinessHistory legacyBaseline={legacyBaseline} />
    </div>
  );
}
