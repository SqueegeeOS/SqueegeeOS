"use client";

import type { ClosedJob } from "@/lib/admin/closed-jobs-types";
import {
  formatCurrency,
  formatDisplayDate,
  formatRecurringFrequency,
  getArrValue,
} from "@/lib/admin/sales-calculations";
import { AdminEmptySalesState } from "./admin-empty-sales-state";

interface RecentClosedJobsTableProps {
  jobs: ClosedJob[];
  totalJobCount: number;
}

export function RecentClosedJobsTable({
  jobs,
  totalJobCount,
}: RecentClosedJobsTableProps) {
  if (totalJobCount === 0) {
    return <AdminEmptySalesState />;
  }

  if (jobs.length === 0) {
    return <AdminEmptySalesState variant="filtered" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border/70 text-[10px] uppercase tracking-[0.22em] text-muted">
            <th className="pb-3 pr-4 font-medium">Customer</th>
            <th className="pb-3 pr-4 font-medium">Service</th>
            <th className="pb-3 pr-4 font-medium">Sale Amount</th>
            <th className="pb-3 pr-4 font-medium">Recurring Frequency</th>
            <th className="pb-3 pr-4 font-medium">ARR Value</th>
            <th className="pb-3 font-medium">Date Closed</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr
              key={job.id}
              className="border-b border-border/40 text-foreground/90 last:border-0"
            >
              <td className="py-4 pr-4 align-top font-medium text-foreground">
                {job.customerName}
              </td>
              <td className="py-4 pr-4 align-top text-muted">
                {job.serviceCategory}
              </td>
              <td className="py-4 pr-4 align-top font-serif text-lg font-light text-accent">
                {formatCurrency(job.saleAmount)}
              </td>
              <td className="py-4 pr-4 align-top text-muted">
                {formatRecurringFrequency(job.recurringFrequency)}
              </td>
              <td className="py-4 pr-4 align-top font-serif text-lg font-light text-foreground">
                {(() => {
                  const arr = getArrValue(job);
                  return arr > 0 ? formatCurrency(arr) : "—";
                })()}
              </td>
              <td className="py-4 align-top text-muted">
                {formatDisplayDate(job.closedDate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
