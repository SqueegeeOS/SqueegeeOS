"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { CeoScoreboard } from "@/lib/admin/ceo-scoreboard";
import type { OperatingSnapshot } from "@/lib/admin/growth-journey";
import { formatCurrency } from "@/lib/admin/sales-calculations";

const easeLuxury = [0.22, 1, 0.36, 1] as const;

interface AdminCeoScoreboardProps {
  scoreboard: CeoScoreboard;
  awaitingData?: boolean;
}

function ProgressBar({
  label,
  progress,
  detail,
}: {
  label: string;
  progress: number;
  detail: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted">
          {label}
        </p>
        <p className="text-xs text-muted/80">{progress}%</p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border/60">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1, ease: easeLuxury }}
          className="h-full rounded-full bg-gradient-to-r from-accent/70 to-accent"
        />
      </div>
      <p className="mt-2 text-xs text-muted/75">{detail}</p>
    </div>
  );
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
    <tr className="border-b border-border/40 last:border-0">
      <td className="px-4 py-3 pr-3 text-sm text-muted">{label}</td>
      <td className="px-4 py-3 pr-3 text-right font-serif text-base font-light text-muted">
        {fmt(legacy)}
      </td>
      <td className="px-4 py-3 pr-3 text-right font-serif text-base font-light text-accent">
        {fmt(operatingSystem)}
      </td>
      <td className="px-4 py-3 text-right font-serif text-base font-light text-foreground">
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
    { label: "Lifetime Revenue", legacy: legacy.lifetimeRevenue, os: os.lifetimeRevenue, company: company.lifetimeRevenue, format: "currency" as const },
    { label: "Lifetime ARR", legacy: legacy.lifetimeArr, os: os.lifetimeArr, company: company.lifetimeArr, format: "currency" as const },
    { label: "Closed Jobs", legacy: legacy.closedJobsCount, os: os.closedJobsCount, company: company.closedJobsCount, format: "count" as const },
    { label: "Homes Protected", legacy: legacy.homesProtected, os: os.homesProtected, company: company.homesProtected, format: "count" as const },
    { label: "Members", legacy: legacy.membersProtected, os: os.membersProtected, company: company.membersProtected, format: "count" as const },
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
      sub: "Operating System · this month",
    },
    {
      label: "ARR Generated",
      value: formatCurrency(scoreboard.arrGenerated),
      sub: "Operating System · this month",
    },
    {
      label: "Monthly Sales Performance",
      value: formatCurrency(scoreboard.monthlySalesPerformance),
      sub: "OS business value · this month",
      accent: true,
    },
  ];

  return (
    <div className="space-y-6">
      <motion.article
        initial={reduceMotion ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.85, ease: easeLuxury }}
        className="relative overflow-hidden rounded-[2rem] border border-border/80 bg-gradient-to-br from-surface/90 via-surface/60 to-background/40 p-7 sm:p-9"
      >
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-accent/[0.06] blur-3xl" />
        <p className="text-[10px] uppercase tracking-[0.32em] text-accent">
          CEO Scoreboard
        </p>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Legacy honors what you built. Operating System tracks every sale logged
          forward. Company totals are the honest sum — never faked.
        </p>

        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          {monthlyMetrics.map((metric, index) => (
            <motion.div
              key={metric.label}
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.6,
                delay: reduceMotion ? 0 : index * 0.06,
                ease: easeLuxury,
              }}
              className="rounded-[1.25rem] border border-border/60 bg-background/30 px-4 py-4"
            >
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted">
                {metric.label}
              </p>
              <p
                className={`mt-2 font-serif text-2xl font-light sm:text-3xl ${
                  metric.accent ? "text-accent" : "text-foreground"
                }`}
              >
                {metric.value}
              </p>
              <p className="mt-1 text-xs text-muted/75">{metric.sub}</p>
              {awaitingData && (
                <span className="mt-2 inline-flex rounded-full border border-border/80 bg-background/50 px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] text-muted/80">
                  Awaiting OS data
                </span>
              )}
            </motion.div>
          ))}
        </div>

        <div className="mt-8 overflow-x-auto rounded-[1.25rem] border border-border/60">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-background/30 text-[10px] uppercase tracking-[0.18em] text-muted">
                <th className="px-4 py-3 font-medium">Metric</th>
                <th className="px-4 py-3 text-right font-medium">Legacy</th>
                <th className="px-4 py-3 text-right font-medium">
                  Operating System
                </th>
                <th className="px-4 py-3 text-right font-medium">Company</th>
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

        <div className="mt-6 grid gap-5 border-t border-border/60 pt-6 lg:grid-cols-2">
          <ProgressBar
            label={scoreboard.arrProgress.label}
            progress={scoreboard.arrProgress.progress}
            detail={`${formatCurrency(scoreboard.arrProgress.current)} of ${formatCurrency(scoreboard.arrProgress.target)}`}
          />
          <ProgressBar
            label={scoreboard.monthlyGoalProgress.label}
            progress={scoreboard.monthlyGoalProgress.progress}
            detail={`${formatCurrency(scoreboard.monthlyGoalProgress.current)} of ${formatCurrency(scoreboard.monthlyGoalProgress.target)} goal`}
          />
        </div>
      </motion.article>

      <motion.article
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: reduceMotion ? 0 : 0.1, ease: easeLuxury }}
        className="rounded-[1.75rem] border border-border/80 bg-surface/50 p-6 sm:p-7"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-muted">
              Business Health Score
            </p>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
              {scoreboard.businessHealthExplanation}
            </p>
          </div>
          <div className="flex items-center gap-4 sm:shrink-0">
            <div className="relative flex h-20 w-20 items-center justify-center">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 80 80">
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-border/60"
                />
                <motion.circle
                  cx="40"
                  cy="40"
                  r="34"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  className="text-accent"
                  strokeDasharray={2 * Math.PI * 34}
                  initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
                  animate={{
                    strokeDashoffset:
                      2 * Math.PI * 34 *
                      (1 - scoreboard.businessHealthScore / 100),
                  }}
                  transition={{ duration: 1.2, ease: easeLuxury }}
                />
              </svg>
              <span className="font-serif text-2xl font-light text-foreground">
                {scoreboard.businessHealthScore}
              </span>
            </div>
          </div>
        </div>
      </motion.article>
    </div>
  );
}
