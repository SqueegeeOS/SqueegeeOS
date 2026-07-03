"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ExecutiveStats } from "@/lib/admin/closed-jobs-types";
import { formatCurrency } from "@/lib/admin/sales-calculations";

const easeLuxury = [0.22, 1, 0.36, 1] as const;

interface AdminHeroMetricsProps {
  stats: ExecutiveStats;
}

export function AdminHeroMetrics({ stats }: AdminHeroMetricsProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="space-y-6">
      <motion.article
        initial={reduceMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: easeLuxury }}
        className="relative overflow-hidden rounded-[2rem] border border-accent/25 bg-gradient-to-br from-accent/[0.12] via-surface/80 to-background p-8 sm:p-10"
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/[0.08] blur-3xl" />
        <p className="text-[10px] uppercase tracking-[0.32em] text-accent">
          Monthly Sales Performance
        </p>
        <p className="mt-4 font-serif text-5xl font-light tracking-tight text-foreground sm:text-7xl">
          {formatCurrency(stats.monthlySalesPerformance)}
        </p>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">
          Revenue collected plus annual recurring value generated — the number that
          reflects the true value you built this period.
        </p>
        <div className="mt-8 grid gap-4 border-t border-border/60 pt-6 sm:grid-cols-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted">
              Revenue Collected
            </p>
            <p className="mt-2 font-serif text-3xl font-light text-foreground">
              {formatCurrency(stats.revenueCollected)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted">
              ARR Generated
            </p>
            <p className="mt-2 font-serif text-3xl font-light text-accent">
              {formatCurrency(stats.arrGenerated)}
            </p>
          </div>
        </div>
      </motion.article>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Jobs Closed", value: String(stats.jobsClosed) },
          { label: "Memberships Sold", value: String(stats.membershipsSold) },
          { label: "New Customers", value: String(stats.newCustomers) },
          {
            label: "Average Ticket",
            value: formatCurrency(stats.averageTicket),
            detail: "Based on revenue collected",
          },
        ].map((item, index) => (
          <motion.div
            key={item.label}
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.7,
              delay: reduceMotion ? 0 : 0.08 * index,
              ease: easeLuxury,
            }}
            className="rounded-[1.5rem] border border-border/80 bg-surface/50 px-5 py-5"
          >
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted">
              {item.label}
            </p>
            <p className="mt-3 font-serif text-3xl font-light text-foreground">
              {item.value}
            </p>
            {item.detail && (
              <p className="mt-2 text-xs text-muted/80">{item.detail}</p>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
