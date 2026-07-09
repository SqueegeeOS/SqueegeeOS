"use client";

import type { BillingWorkspaceOverview } from "@/lib/admin/billing-workspace-types";
import { formatCurrency } from "@/lib/admin/sales-calculations";
import { craftEyebrow } from "@/lib/craft/tokens";

export function BillingOverview({
  overview,
}: {
  overview: BillingWorkspaceOverview;
}) {
  const metrics = [
    {
      label: "Customers ready to bill",
      value: String(overview.readyToBillCount),
      accent: overview.readyToBillCount > 0,
    },
    {
      label: "Expected revenue this month",
      value: formatCurrency(overview.expectedRevenueThisMonth),
      accent: true,
    },
    {
      label: "Collected this month",
      value: formatCurrency(overview.collectedThisMonth),
      note: "From recorded ledger entries",
    },
    {
      label: "Upcoming charges",
      value: String(overview.upcomingChargesCount),
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((item) => (
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
          {item.note ? (
            <p className="mt-2 text-xs leading-relaxed text-muted">{item.note}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
