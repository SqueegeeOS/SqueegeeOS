"use client";

import { motion, useReducedMotion } from "framer-motion";
import { GlassCard } from "@/components/craft/glass-card";
import type { CeoScoreboard } from "@/lib/admin/ceo-scoreboard";
import type { OperatingSnapshot } from "@/lib/admin/growth-journey";
import { formatCurrency } from "@/lib/admin/sales-calculations";
import { craftEyebrow, craftFieldLabel, craftTableHead } from "@/lib/craft/tokens";
import { pageEnter } from "@/lib/motion/system";

interface AdminCeoScoreboardProps {
  scoreboard: CeoScoreboard;
  awaitingData?: boolean;
}

function LedgerRow({
  label,
  legacy,
  operatingSystem,
  company,
  format = "currency",
}: {
  label: string;
  legacy: number;
  operatingSystem: number;
  company: number;
  format?: "currency" | "count";
}) {
  const fmt = (value: number) =>
    format === "currency" ? formatCurrency(value) : String(value);

  return (
    <tr className="border-b border-border/20 last:border-0">
      <td className="py-3 pr-3 text-sm text-muted">{label}</td>
      <td className="py-3 pr-3 text-right font-serif text-base font-light text-muted/80">
        {fmt(legacy)}
      </td>
      <td className="py-3 pr-3 text-right font-serif text-base font-light text-foreground/90">
        {fmt(operatingSystem)}
      </td>
      <td className="py-3 text-right font-serif text-base font-light text-foreground">
        {fmt(company)}
      </td>
    </tr>
  );
}

function ledgerRows(
  legacy: OperatingSnapshot,
  os: OperatingSnapshot,
  company: OperatingSnapshot,
) {
  return [
    {
      label: "Lifetime Revenue",
      legacy: legacy.lifetimeRevenue,
      os: os.lifetimeRevenue,
      company: company.lifetimeRevenue,
      format: "currency" as const,
    },
    {
      label: "Lifetime ARR",
      legacy: legacy.lifetimeArr,
      os: os.lifetimeArr,
      company: company.lifetimeArr,
      format: "currency" as const,
    },
    {
      label: "Closed Jobs",
      legacy: legacy.closedJobsCount,
      os: os.closedJobsCount,
      company: company.closedJobsCount,
      format: "count" as const,
    },
    {
      label: "Homes Protected",
      legacy: legacy.homesProtected,
      os: os.homesProtected,
      company: company.homesProtected,
      format: "count" as const,
    },
    {
      label: "Members",
      legacy: legacy.membersProtected,
      os: os.membersProtected,
      company: company.membersProtected,
      format: "count" as const,
    },
  ];
}

export function AdminCeoScoreboard({
  scoreboard,
  awaitingData = false,
}: AdminCeoScoreboardProps) {
  const reduceMotion = useReducedMotion();
  const { ledger } = scoreboard;
  const rows = ledgerRows(ledger.legacy, ledger.operatingSystem, ledger.company);

  const monthlyMetrics = [
    {
      label: "Revenue Collected",
      value: formatCurrency(scoreboard.revenueCollected),
    },
    {
      label: "ARR Generated",
      value: formatCurrency(scoreboard.arrGenerated),
    },
    {
      label: "Monthly Sales",
      value: formatCurrency(scoreboard.monthlySalesPerformance),
    },
  ];

  return (
    <motion.article
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      variants={pageEnter}
      className="border-t border-border/15 pt-14"
    >
      <p className={craftEyebrow}>Company pulse</p>
      <p className="mt-4 max-w-md text-sm leading-[1.65] text-muted">
        This month in the Operating System — legacy totals preserved separately.
      </p>

      <GlassCard tone="default" motion="none" padding="md" className="mt-8">
      <div className="space-y-6">
        {monthlyMetrics.map((metric, index) => (
          <motion.div
            key={metric.label}
            initial={reduceMotion ? false : "hidden"}
            animate="visible"
            variants={pageEnter}
            transition={{ delay: reduceMotion ? 0 : index * 0.05 }}
          >
            <p className={craftFieldLabel}>
              {metric.label}
            </p>
            <p className="mt-1.5 font-serif text-2xl font-light text-foreground sm:text-3xl">
              {metric.value}
            </p>
            {awaitingData && index === 0 && (
              <p className="mt-1 text-xs text-muted/70">Awaiting first OS sale</p>
            )}
          </motion.div>
        ))}
      </div>

      <div className="mt-8 overflow-x-auto border-t border-white/[0.06] pt-6">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className={`border-b border-border/20 ${craftTableHead}`}>
              <th className="pb-3 font-medium">Metric</th>
              <th className="pb-3 text-right font-medium">Legacy</th>
              <th className="pb-3 text-right font-medium">OS</th>
              <th className="pb-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <LedgerRow
                key={row.label}
                label={row.label}
                legacy={row.legacy}
                operatingSystem={row.os}
                company={row.company}
                format={row.format}
              />
            ))}
          </tbody>
        </table>
      </div>
      </GlassCard>
    </motion.article>
  );
}
