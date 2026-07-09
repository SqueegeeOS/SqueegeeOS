"use client";

import type { WebsiteMembershipSalesOverview } from "@/lib/admin/website-membership-sales-types";
import { formatWebsiteMembershipSaleTier } from "@/lib/admin/website-membership-sales";
import { formatCurrency } from "@/lib/admin/sales-calculations";
import { craftEyebrow, craftTableHead } from "@/lib/craft/tokens";
import { CustomerWorkspaceLink } from "@/components/admin/customer-workspace-link";

export function WebsiteMembershipSalesSection({
  overview,
}: {
  overview: WebsiteMembershipSalesOverview;
}) {
  const metrics = [
    { label: "Today", value: String(overview.todayCount) },
    { label: "This month", value: String(overview.monthCount) },
    {
      label: "Month ARR",
      value: formatCurrency(overview.monthAnnualizedValue),
      accent: true,
    },
    {
      label: "Total ARR",
      value: formatCurrency(overview.totalAnnualizedValue),
      accent: true,
    },
  ];

  return (
    <div className="space-y-6">
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
          </div>
        ))}
      </div>

      {overview.source === "unavailable" ? (
        <p className="text-sm text-muted">
          Website sales tracking will appear after migration 022 is applied.
        </p>
      ) : overview.recentSales.length === 0 ? (
        <p className="text-sm text-muted">
          No website membership sales yet. Completed presentation signups with a
          card on file will appear here automatically.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className={`border-b border-border/70 ${craftTableHead}`}>
                <th className="pb-3 pr-4 font-medium">Customer</th>
                <th className="pb-3 pr-4 font-medium">Tier</th>
                <th className="pb-3 pr-4 font-medium">Visit</th>
                <th className="pb-3 pr-4 font-medium">Annualized</th>
                <th className="pb-3 pr-4 font-medium">Sold</th>
              </tr>
            </thead>
            <tbody>
              {overview.recentSales.map((sale) => (
                <tr
                  key={sale.id}
                  className="border-b border-border/40 align-top"
                >
                  <td className="py-3 pr-4">
                    <CustomerWorkspaceLink type="property" id={sale.propertyId}>
                      {sale.customerName}
                    </CustomerWorkspaceLink>
                    <p className="mt-1 text-xs text-muted">
                      {sale.propertyAddress}
                    </p>
                  </td>
                  <td className="py-3 pr-4">
                    {formatWebsiteMembershipSaleTier(sale.tier)}
                  </td>
                  <td className="py-3 pr-4 tabular-nums">
                    {formatCurrency(sale.visitPrice)}
                  </td>
                  <td className="py-3 pr-4 tabular-nums text-accent">
                    {formatCurrency(sale.annualizedValue)}
                  </td>
                  <td className="py-3 pr-4 text-muted">
                    {new Date(sale.soldAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
