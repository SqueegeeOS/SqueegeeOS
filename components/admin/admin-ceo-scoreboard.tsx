"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { CeoScoreboard } from "@/lib/admin/ceo-scoreboard";
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

export function AdminCeoScoreboard({
  scoreboard,
  awaitingData = false,
}: AdminCeoScoreboardProps) {
  const reduceMotion = useReducedMotion();

  const primaryMetrics = [
    {
      label: "Revenue Collected",
      value: formatCurrency(scoreboard.revenueCollected),
      sub: "This month",
    },
    {
      label: "ARR Generated",
      value: formatCurrency(scoreboard.arrGenerated),
      sub: "This month",
    },
    {
      label: "Monthly Sales Performance",
      value: formatCurrency(scoreboard.monthlySalesPerformance),
      sub: "Business value created",
      accent: true,
    },
    {
      label: "Lifetime Revenue",
      value: formatCurrency(scoreboard.lifetimeRevenue),
      sub: "All time",
    },
  ];

  const protectionMetrics = [
    {
      label: "Homes Protected",
      value: String(scoreboard.homesProtected),
    },
    {
      label: "Members Protected",
      value: String(scoreboard.membersProtected),
    },
    {
      label: "Lifetime ARR",
      value: formatCurrency(scoreboard.lifetimeArr),
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

        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {primaryMetrics.map((metric, index) => (
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
                  Awaiting Data
                </span>
              )}
            </motion.div>
          ))}
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

        <div className="mt-6 grid gap-3 border-t border-border/60 pt-6 sm:grid-cols-3">
          {protectionMetrics.map((metric) => (
            <div key={metric.label} className="px-1">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted">
                {metric.label}
              </p>
              <p className="mt-1 font-serif text-xl font-light text-foreground">
                {metric.value}
              </p>
            </div>
          ))}
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
                      2 * Math.PI * 34 * (1 - scoreboard.businessHealthScore / 100),
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
