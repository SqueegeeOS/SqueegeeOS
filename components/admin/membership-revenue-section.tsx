"use client";

import type { MembershipRevenueOverview } from "@/lib/admin/closed-jobs-types";
import { formatCurrency } from "@/lib/admin/sales-calculations";
import { craftEyebrow } from "@/lib/craft/tokens";

export function MembershipRevenueSection({
  membership,
  awaitingData = false,
}: {
  membership: MembershipRevenueOverview;
  awaitingData?: boolean;
}) {
  const hasMembers =
    membership.active + membership.pending + membership.canceled > 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[
        { label: "Active", value: String(membership.active) },
        { label: "Pending", value: String(membership.pending) },
        { label: "Canceled", value: String(membership.canceled) },
        {
          label: "Est. MRR",
          value: formatCurrency(membership.estimatedMrr),
          accent: true,
        },
      ].map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border border-border/80 bg-background/40 p-5"
        >
          <p className={craftEyebrow}>{item.label}</p>
          <p
            className={`mt-2 font-serif text-3xl font-light tabular-nums ${
              item.accent ? "text-accent" : "text-foreground"
            }`}
          >
            {item.value}
          </p>
          {awaitingData && (
            <span className="mt-3 inline-flex rounded-full border border-border/80 bg-background/50 px-2.5 py-1 text-[9px] uppercase tracking-[0.2em] text-muted/80">
              Awaiting Data
            </span>
          )}
        </div>
      ))}
      <p className="sm:col-span-2 lg:col-span-4 text-sm text-muted">
        {hasMembers ? (
          <>
            Most popular tier:{" "}
            <span className="text-foreground/90">{membership.popularTier}</span>
          </>
        ) : (
          <span className="text-muted/80">
            Membership tiers will appear as members join.
          </span>
        )}
        <span className="ml-2 text-xs uppercase tracking-[0.16em] text-muted/70">
          · Stripe not connected
        </span>
      </p>
    </div>
  );
}
