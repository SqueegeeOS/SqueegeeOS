"use client";

import type { MembershipRevenueOverview } from "@/lib/admin/closed-jobs-types";
import { formatCurrency } from "@/lib/admin/sales-calculations";

export function MembershipRevenueSection({
  membership,
}: {
  membership: MembershipRevenueOverview;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-2xl border border-border/80 bg-background/40 p-5">
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted">Active</p>
        <p className="mt-2 font-serif text-3xl font-light text-foreground">
          {membership.active}
        </p>
      </div>
      <div className="rounded-2xl border border-border/80 bg-background/40 p-5">
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted">Pending</p>
        <p className="mt-2 font-serif text-3xl font-light text-foreground">
          {membership.pending}
        </p>
      </div>
      <div className="rounded-2xl border border-border/80 bg-background/40 p-5">
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted">Canceled</p>
        <p className="mt-2 font-serif text-3xl font-light text-foreground">
          {membership.canceled}
        </p>
      </div>
      <div className="rounded-2xl border border-border/80 bg-background/40 p-5">
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted">
          Est. MRR
        </p>
        <p className="mt-2 font-serif text-3xl font-light text-accent">
          {formatCurrency(membership.estimatedMrr)}
        </p>
      </div>
      <p className="sm:col-span-2 lg:col-span-4 text-sm text-muted">
        Most popular tier:{" "}
        <span className="text-foreground/90">{membership.popularTier}</span>
        <span className="ml-2 text-xs uppercase tracking-[0.16em] text-muted/70">
          · Stripe not connected
        </span>
      </p>
    </div>
  );
}
