"use client";

import type { MembershipHealthBadge } from "@/lib/admin/membership-command-center-types";

const BADGE_CONFIG: Record<
  MembershipHealthBadge,
  { label: string; className: string }
> = {
  active: {
    label: "Active",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  },
  needs_card: {
    label: "Needs card",
    className: "border-amber-500/35 bg-amber-500/10 text-amber-200",
  },
  needs_scheduling: {
    label: "Needs scheduling",
    className: "border-sky-500/30 bg-sky-500/10 text-sky-200",
  },
  due_this_month: {
    label: "Due this month",
    className: "border-accent/35 bg-accent/10 text-accent",
  },
  past_due: {
    label: "Past due",
    className: "border-red-500/35 bg-red-500/10 text-red-300",
  },
  attention: {
    label: "Attention",
    className: "border-orange-500/35 bg-orange-500/10 text-orange-200",
  },
};

export function MembershipHealthBadge({
  badge,
}: {
  badge: MembershipHealthBadge;
}) {
  const config = BADGE_CONFIG[badge];
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] ${config.className}`}
    >
      {config.label}
    </span>
  );
}

export function MembershipHealthBadgeList({
  badges,
}: {
  badges: MembershipHealthBadge[];
}) {
  if (badges.length === 0) {
    return <span className="text-xs text-muted">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((badge) => (
        <MembershipHealthBadge key={badge} badge={badge} />
      ))}
    </div>
  );
}
