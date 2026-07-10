"use client";

import type { MembershipProductionRevenueOverview } from "@/lib/admin/membership-production-revenue-types";
import { formatCurrency } from "@/lib/admin/sales-calculations";
import { craftEyebrow, craftTableHead } from "@/lib/craft/tokens";
import { CustomerWorkspaceLink } from "@/components/admin/customer-workspace-link";

function tierLabel(tier: "biannual" | "quarterly" | "unknown"): string {
  if (tier === "biannual") return "Bi-Annual";
  if (tier === "quarterly") return "Quarterly";
  return "Unknown";
}

export function MembershipProductionRevenueSection({
  overview,
}: {
  overview: MembershipProductionRevenueOverview;
}) {
  const metrics = [
    {
      label: "Members signed today",
      value: String(overview.membersSignedToday),
      hint: "Agreement signed today (Pacific Time)",
    },
    {
      label: "Active membership value",
      value: formatCurrency(overview.activeMembershipValue),
      hint: "Yearly value · strict active members",
      accent: true,
    },
    {
      label: "Expected yearly membership revenue",
      value: formatCurrency(overview.expectedYearlyMembershipRevenue),
      hint: "All on-book members",
      accent: true,
    },
    {
      label: "Add-on revenue collected",
      value: formatCurrency(overview.addonRevenueCollected),
      hint: "Completed/paid add-ons",
    },
    {
      label: "Total customer revenue",
      value: formatCurrency(overview.totalCustomerRevenue),
      hint: "Expected yearly + collected add-ons",
      accent: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
            <p className="mt-2 text-xs text-muted">{item.hint}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border/60 bg-background/30 px-5 py-4 text-sm text-muted">
        <p>
          <span className="text-foreground/90">{overview.membersOnBook}</span>{" "}
          member{overview.membersOnBook === 1 ? "" : "s"} on book ·{" "}
          <span className="text-foreground/90">{overview.cardOnFileCount}</span>{" "}
          with card on file ·{" "}
          <span className="text-foreground/90">
            {overview.membersSignedThisMonth}
          </span>{" "}
          signed this month
        </p>
        <p className="mt-2 text-xs">
          Same production data as Membership Command Center. Cancelled/archived
          excluded. No demo rows without a signed agreement.
        </p>
      </div>

      {overview.source === "unavailable" ? (
        <p className="text-sm text-muted">
          Membership revenue will appear when Supabase is connected.
        </p>
      ) : overview.recentSignings.length === 0 ? (
        <p className="text-sm text-muted">
          No signed memberships on file yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className={`border-b border-border/70 ${craftTableHead}`}>
                <th className="pb-3 pr-4 font-medium">Customer</th>
                <th className="pb-3 pr-4 font-medium">Tier</th>
                <th className="pb-3 pr-4 font-medium">Visit</th>
                <th className="pb-3 pr-4 font-medium">Yearly value</th>
                <th className="pb-3 pr-4 font-medium">Card</th>
                <th className="pb-3 font-medium">Signed</th>
              </tr>
            </thead>
            <tbody>
              {overview.recentSignings.map((signing) => (
                <tr
                  key={signing.membershipId}
                  className="border-b border-border/40 align-top"
                >
                  <td className="py-3 pr-4">
                    <CustomerWorkspaceLink
                      type="property"
                      id={signing.propertyId}
                    >
                      {signing.customerName}
                    </CustomerWorkspaceLink>
                    <p className="mt-1 text-xs text-muted">
                      {signing.propertyAddress}
                    </p>
                  </td>
                  <td className="py-3 pr-4">{tierLabel(signing.tier)}</td>
                  <td className="py-3 pr-4 tabular-nums">
                    {signing.visitPrice != null
                      ? formatCurrency(signing.visitPrice)
                      : "—"}
                  </td>
                  <td className="py-3 pr-4 tabular-nums text-accent">
                    {signing.yearlyValue != null
                      ? formatCurrency(signing.yearlyValue)
                      : "—"}
                  </td>
                  <td className="py-3 pr-4 text-muted">
                    {signing.cardOnFile ? "On file" : "Needs card"}
                  </td>
                  <td className="py-3 pr-4 text-muted">
                    {new Date(signing.signedAt).toLocaleDateString("en-US", {
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
