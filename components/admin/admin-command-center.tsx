"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import { FOUNDER_NOTES_KEY } from "@/lib/admin/config";
import { loadLocalClosedJobs } from "@/lib/admin/closed-jobs-store";
import type {
  AdminDashboardData,
  RevenuePeriodFilter,
} from "@/lib/admin/closed-jobs-types";
import {
  computeExecutiveStats,
  computeMonthlyLedger,
  computeRevenueChartSeries,
  filterJobsByPeriod,
  formatCurrency,
  mergeClosedJobs,
} from "@/lib/admin/sales-calculations";
import { clearAdminSession } from "@/lib/admin/pin";
import { ROUTES } from "@/lib/navigation/config";
import { AdminHeroMetrics } from "./admin-hero-metrics";
import { AdminRevenueCharts } from "./admin-revenue-charts";
import { AdminSection } from "./admin-section";
import { AdminStatCard } from "./admin-stat-card";
import { ClosedJobsForm } from "./closed-jobs-form";
import { MembershipRevenueSection } from "./membership-revenue-section";
import { MonthlySalesLedger } from "./monthly-sales-ledger";
import { RecentClosedJobsTable } from "./recent-closed-jobs-table";
import { RevenuePeriodFilterBar } from "./revenue-period-filter";

const easeLuxury = [0.22, 1, 0.36, 1] as const;

const PERIOD_SECTION_LABELS: Record<RevenuePeriodFilter, string> = {
  current_month: "This month at a glance",
  last_30_days: "Last 30 days at a glance",
  year: "This year at a glance",
  all_time: "All-time performance",
};

export function AdminCommandCenter() {
  const reduceMotion = useReducedMotion();
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [periodFilter, setPeriodFilter] =
    useState<RevenuePeriodFilter>("current_month");
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState({
    todaysFocus: "",
    followUps: "",
    customersToCall: "",
  });

  const loadDashboard = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    try {
      const localJobs = loadLocalClosedJobs();
      const response = await fetch("/api/admin/overview", {
        headers: getAdminRequestHeaders(),
      });

      if (!response.ok) throw new Error("Failed to load dashboard");

      const serverData = (await response.json()) as AdminDashboardData;
      const closedJobs = mergeClosedJobs(serverData.closedJobs, localJobs);

      setDashboard({
        ...serverData,
        closedJobs,
        storage: localJobs.length > 0 ? "local" : serverData.storage,
        dataSources: {
          ...serverData.dataSources,
          closedJobs:
            localJobs.length > 0 && serverData.storage === "supabase"
              ? "mixed"
              : localJobs.length > 0
                ? "local"
                : serverData.dataSources.closedJobs,
          executive:
            localJobs.length > 0 ? "mixed" : serverData.dataSources.executive,
        },
      });
    } catch {
      const localJobs = loadLocalClosedJobs();
      const closedJobs = mergeClosedJobs([], localJobs);
      setDashboard({
        executive: computeExecutiveStats(
          filterJobsByPeriod(closedJobs, "current_month"),
        ),
        closedJobs,
        monthlyLedger: computeMonthlyLedger(
          filterJobsByPeriod(closedJobs, "current_month"),
        ),
        membership: {
          active: 2,
          pending: 1,
          canceled: 0,
          estimatedMrr: 1840,
          popularTier: "Preferred Membership",
          source: "mock",
        },
        dataSources: {
          closedJobs: "local",
          executive: "local",
          membership: "mock",
        },
        storage: "local",
        supabaseConnected: false,
        privateBeta: true,
      });
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const raw = localStorage.getItem(FOUNDER_NOTES_KEY);
    if (!raw) return;
    try {
      setNotes(JSON.parse(raw));
    } catch {
      // ignore invalid saved notes
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(FOUNDER_NOTES_KEY, JSON.stringify(notes));
  }, [notes]);

  const filteredJobs = useMemo(() => {
    if (!dashboard) return [];
    return filterJobsByPeriod(dashboard.closedJobs, periodFilter);
  }, [dashboard, periodFilter]);

  const stats = useMemo(() => {
    if (!dashboard) return null;
    return computeExecutiveStats(filteredJobs, {
      activeMembers: dashboard.executive.activeMembers,
      homeCarePlansCreated: dashboard.executive.homeCarePlansCreated,
      pendingRequests: dashboard.executive.pendingRequests,
      signedAgreements: dashboard.executive.signedAgreements,
    });
  }, [dashboard, filteredJobs]);

  const ledger = useMemo(
    () => computeMonthlyLedger(filteredJobs),
    [filteredJobs],
  );

  const chartSeries = useMemo(() => {
    if (!dashboard) return null;
    return computeRevenueChartSeries(dashboard.closedJobs);
  }, [dashboard]);

  if (loading || !dashboard || !stats || !chartSeries) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-background text-muted">
        Loading command center…
      </div>
    );
  }

  const platformStatCards = [
    {
      label: "Revenue Collected",
      value: formatCurrency(stats.revenueCollected),
      detail: "Cash collected in this period",
    },
    {
      label: "ARR Generated",
      value: formatCurrency(stats.arrGenerated),
      detail: "Annual contract value sold",
    },
    { label: "Active Members", value: String(stats.activeMembers) },
    {
      label: "Home Care Plans Created",
      value: String(stats.homeCarePlansCreated),
    },
    { label: "Pending Requests", value: String(stats.pendingRequests) },
    { label: "Signed Agreements", value: String(stats.signedAgreements) },
    { label: "Close Rate", value: stats.closeRatePlaceholder },
  ];

  const quickActions = [
    { label: "Create Home Care Plan", href: ROUTES.createPlan },
    { label: "View Properties", href: ROUTES.properties },
    { label: "View Requests", href: ROUTES.requests },
    {
      label: "View Member Portal Sample",
      href: "/homecare/larry-buckley/canyon-oaks-residence/portal",
    },
    { label: "Open Supabase Health", href: "/api/persistence/health", external: true },
    { label: "Open Live Website", href: ROUTES.home },
  ];

  return (
    <div className="relative min-h-[100svh] overflow-x-hidden bg-background pb-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,184,150,0.08),transparent_55%)]" />

      <div className="relative mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14 lg:px-10">
        <motion.header
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: easeLuxury }}
          className="flex flex-col gap-6 border-b border-border/70 pb-10 lg:flex-row lg:items-end lg:justify-between"
        >
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-accent">
              Owner Command Center
            </p>
            <h1 className="mt-4 font-serif text-4xl font-light leading-[1.05] text-foreground sm:text-6xl">
              Welcome back, Noah &amp; Dasan.
            </h1>
            <p className="mt-3 font-serif text-xl font-light tracking-[0.08em] text-foreground/85 sm:text-2xl">
              SqueegeeKing Command Center
            </p>
            <p className="mt-5 max-w-3xl text-base leading-relaxed text-muted sm:text-lg">
              Track revenue collected, ARR generated, and the true value of every
              closed job — updated the moment you log a sale.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-border px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-muted">
              {dashboard.storage === "supabase" ? "Cloud ledger" : "Local / demo ledger"}
            </span>
            {dashboard.privateBeta && (
              <span className="rounded-full border border-accent/25 bg-accent/[0.06] px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-accent">
                Private beta
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                clearAdminSession();
                window.location.reload();
              }}
              className="rounded-full border border-border px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:border-accent/30 hover:text-accent"
            >
              Lock Command Center
            </button>
          </div>
        </motion.header>

        <div className="mt-8">
          <RevenuePeriodFilterBar value={periodFilter} onChange={setPeriodFilter} />
        </div>

        <div className="mt-8">
          <AdminSection
            eyebrow="Executive Overview"
            title={PERIOD_SECTION_LABELS[periodFilter]}
            description="Immediate revenue plus ARR generated — the full picture of business value created."
            delay={0.05}
          >
            <AdminHeroMetrics stats={stats} />
          </AdminSection>
        </div>

        <div className="mt-8">
          <AdminSection
            eyebrow="Growth Trends"
            title="Revenue intelligence"
            description="Twelve-month trajectory across cash collected, ARR, and total sales performance."
            delay={0.08}
          >
            <AdminRevenueCharts
              revenueCollected={chartSeries.revenueCollected}
              arrGenerated={chartSeries.arrGenerated}
              monthlySalesPerformance={chartSeries.monthlySalesPerformance}
            />
          </AdminSection>
        </div>

        <div className="mt-8">
          <AdminSection
            eyebrow="Platform Pulse"
            title="Living business metrics"
            description="Platform health alongside sales performance for the selected period."
            delay={0.1}
          >
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {platformStatCards.map((card, index) => (
                <AdminStatCard key={card.label} {...card} index={index} />
              ))}
            </div>
          </AdminSection>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_1.1fr]">
          <AdminSection
            id="closed-jobs"
            eyebrow="Closed Jobs"
            title="Log a completed sale"
            description="Enter a job from the field in under a minute. Totals refresh instantly."
            delay={0.12}
          >
            <ClosedJobsForm onLogged={() => void loadDashboard({ silent: true })} />
          </AdminSection>

          <AdminSection
            eyebrow="Monthly Sales Ledger"
            title="Revenue by month"
            description="Revenue collected, ARR generated, and monthly sales performance for the selected period."
            delay={0.14}
          >
            <MonthlySalesLedger entries={ledger} />
          </AdminSection>
        </div>

        <div className="mt-8">
          <AdminSection
            eyebrow="Recent Activity"
            title="Closed jobs"
            description="Every sale with immediate revenue and annual contract value."
            delay={0.16}
          >
            <RecentClosedJobsTable jobs={filteredJobs} />
          </AdminSection>
        </div>

        <div className="mt-8">
          <AdminSection
            eyebrow="Membership Revenue"
            title="Membership overview"
            description="Platform membership health. MRR remains a placeholder until Stripe connects."
            delay={0.18}
          >
            <MembershipRevenueSection membership={dashboard.membership} />
          </AdminSection>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <AdminSection
            eyebrow="Founder Notes"
            title="Private notes for Noah & Dasan"
            delay={0.22}
          >
            <div className="space-y-5">
              {[
                { key: "todaysFocus", label: "Today's focus" },
                { key: "followUps", label: "Follow-ups" },
                { key: "customersToCall", label: "Customers to call" },
              ].map((field) => (
                <div key={field.key}>
                  <label className="mb-2 block text-[10px] uppercase tracking-[0.24em] text-muted">
                    {field.label}
                  </label>
                  <textarea
                    value={notes[field.key as keyof typeof notes]}
                    onChange={(event) =>
                      setNotes((prev) => ({
                        ...prev,
                        [field.key]: event.target.value,
                      }))
                    }
                    rows={3}
                    className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm leading-relaxed text-foreground placeholder:text-muted/50 focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/20"
                    placeholder={`Add ${field.label.toLowerCase()}…`}
                  />
                </div>
              ))}
              <p className="text-xs text-muted/80">
                Saved locally in this browser only.
              </p>
            </div>
          </AdminSection>

          <AdminSection eyebrow="Quick Actions" title="Move with intent" delay={0.25}>
            <div className="grid gap-3">
              {quickActions.map((action) =>
                action.external ? (
                  <a
                    key={action.label}
                    href={action.href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-[52px] items-center justify-between rounded-2xl border border-border bg-background/40 px-5 py-4 text-sm tracking-[0.04em] text-foreground transition-colors hover:border-accent/25"
                  >
                    {action.label}
                    <span className="text-muted">↗</span>
                  </a>
                ) : (
                  <Link
                    key={action.label}
                    href={action.href}
                    className="flex min-h-[52px] items-center justify-between rounded-2xl border border-border bg-background/40 px-5 py-4 text-sm tracking-[0.04em] text-foreground transition-colors hover:border-accent/25"
                  >
                    {action.label}
                    <span className="text-muted">→</span>
                  </Link>
                ),
              )}
            </div>
          </AdminSection>
        </div>

        <motion.footer
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="mt-10 rounded-[1.5rem] border border-border/70 bg-surface/40 px-5 py-4 text-xs leading-relaxed text-muted sm:px-6"
        >
          Closed jobs: {dashboard.dataSources.closedJobs} · Executive stats:{" "}
          {dashboard.dataSources.executive} · Membership: {dashboard.dataSources.membership}.
          Supabase table: run{" "}
          <code className="rounded bg-background px-1.5 py-0.5 text-accent">
            lib/persistence/supabase/migrations/002_closed_jobs.sql
          </code>{" "}
          in the SQL Editor for cloud persistence.
        </motion.footer>
      </div>
    </div>
  );
}
