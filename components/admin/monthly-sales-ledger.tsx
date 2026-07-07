"use client";

import type { MonthlyLedgerEntry } from "@/lib/admin/closed-jobs-types";
import { formatCurrency } from "@/lib/admin/sales-calculations";
import { craftTableHead } from "@/lib/craft/tokens";
import { AdminEmptySalesState } from "./admin-empty-sales-state";

interface MonthlySalesLedgerProps {
  entries: MonthlyLedgerEntry[];
  totalJobCount: number;
}

export function MonthlySalesLedger({
  entries,
  totalJobCount,
}: MonthlySalesLedgerProps) {
  if (totalJobCount === 0) {
    return <AdminEmptySalesState />;
  }

  if (entries.length === 0) {
    return <AdminEmptySalesState variant="filtered" />;
  }

  return (
    <div className="overflow-x-auto rounded-[1.25rem] border border-border/70">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className={`border-b border-border/70 bg-surface/40 ${craftTableHead}`}>
            <th className="px-4 py-3 font-medium">Month</th>
            <th className="px-4 py-3 font-medium">Revenue Collected</th>
            <th className="px-4 py-3 font-medium">ARR Generated</th>
            <th className="px-4 py-3 font-medium">Monthly Sales Performance</th>
            <th className="px-4 py-3 font-medium">Jobs Closed</th>
            <th className="px-4 py-3 font-medium">Memberships Sold</th>
            <th className="px-4 py-3 font-medium">Average Ticket</th>
            <th className="px-4 py-3 font-medium">New Customers</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.monthKey}
              className="border-b border-border/40 last:border-0"
            >
              <td className="px-4 py-4 font-serif text-lg font-light text-foreground">
                {entry.monthLabel}
              </td>
              <td className="px-4 py-4 text-foreground/90">
                {formatCurrency(entry.revenueCollected)}
              </td>
              <td className="px-4 py-4 text-accent">
                {formatCurrency(entry.arrGenerated)}
              </td>
              <td className="px-4 py-4 font-serif text-lg font-light text-foreground">
                {formatCurrency(entry.monthlySalesPerformance)}
              </td>
              <td className="px-4 py-4 text-muted">{entry.closedJobsCount}</td>
              <td className="px-4 py-4 text-muted">{entry.membershipsSold}</td>
              <td className="px-4 py-4 text-muted">
                {formatCurrency(entry.averageTicket)}
              </td>
              <td className="px-4 py-4 text-muted">{entry.newCustomers}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
