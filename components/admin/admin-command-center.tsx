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
import { computeCeoScoreboard } from "@/lib/admin/ceo-scoreboard";
import { computeGrowthJourney } from "@/lib/admin/growth-journey";
import { ROUTES } from "@/lib/navigation/config";
import { AdminCeoScoreboard } from "./admin-ceo-scoreboard";
import { AdminCockpitSidebar } from "./admin-cockpit-sidebar";
import { AdminGrowthJourney } from "./admin-growth-journey";
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
          active: 0,
          pending: 0,
          canceled: 0,
          estimatedMrr: 0,
          popularTier: "—",
          source: "supabase",
        },
        dataSources: {
          closedJobs: localJobs.length > 0 ? "local" : "supabase",
          executive: localJobs.length > 0 ? "local" : "supabase",
          membership: "supabase",
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

  const operatingContext = useMemo(() => {
    if (!dashboard) return null;
    return {
      closedJobs: dashboard.closedJobs,
      activeMembers: dashboard.executive.activeMembers,
      homeCarePlansCreated: dashboard.executive.homeCarePlansCreated,
      pendingRequests: dashboard.executive.pendingRequests,
    };
  }, [dashboard]);

  const scoreboard = useMemo(() => {
    if (!operatingContext) return null;
    return computeCeoScoreboard(operatingContext);
  }, [operatingContext]);

  const growthJourney = useMemo(() => {
    if (!operatingContext) return null;
    return computeGrowthJourney(operatingContext);
  }, [operatingContext]);

  if (loading || !dashboard || !stats || !chartSeries || !scoreboard || !growthJourney) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-background text-muted">
        Loading command center…
      </div>
    );
  }

  const isEmptySlate = dashboard.closedJobs.length === 0;

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

  const topBar = (
    <div className="flex flex-wrap items-center gap-3">
      <span className="rounded-full border border-border px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-muted">
        {dashboard.storage === "supabase" ? "Cloud ledger" : "Local ledger"}
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
  );

  const sidebar = (
    <AdminCockpitSidebar
      closedJobs={dashboard.closedJobs}
      activeMembers={stats.activeMembers}
      homeCarePlansCreated={stats.homeCarePlansCreated}
      pendingRequests={stats.pendingRequests}
      showTodaysFocus={isEmptySlate}
    />
  );

  if (isEmptySlate) {
    return (
      <div className="relative min-h-[100svh] overflow-x-hidden bg-background pb-32">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,184,150,0.1),transparent_58%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(201,184,150,0.04),transparent_45%)]" />

        <div className="relative mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16 lg:px-10 lg:py-20">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <p className="text-[10px] uppercase tracking-[0.32em] text-accent">
              Owner Command Center
            </p>
            {topBar}
          </div>

          <div className="mt-14 xl:grid xl:grid-cols-[1.42fr_0.88fr] xl:items-start xl:gap-16">
            <div className="space-y-14">
              <motion.header
                initial={reduceMotion ? false : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, ease: easeLuxury }}
                className="max-w-2xl"
              >
                <h1 className="font-serif text-4xl font-light leading-[1.08] text-foreground sm:text-6xl lg:text-[4.25rem]">
                  Welcome, Noah &amp; Dasan.
                </h1>
                <p className="mt-8 text-base leading-[1.75] text-muted sm:text-lg">
                  Every great company starts with its first customer.
                  <br className="hidden sm:block" />
                  Your command center is ready.
                  <br className="hidden sm:block" />
                  Log your first completed job to begin building the history of
                  SqueegeeKing.
                </p>
              </motion.header>

              <AdminCeoScoreboard scoreboard={scoreboard} awaitingData />

              <AdminSection
                eyebrow="Growth Journey"
                title="Building something meaningful"
                description="Every milestone marks real progress — from first job to market leader."
                delay={0.06}
              >
                <AdminGrowthJourney tiers={growthJourney} />
              </AdminSection>

              <AdminRevenueCharts
                revenueCollected={chartSeries.revenueCollected}
                arrGenerated={chartSeries.arrGenerated}
                monthlySalesPerformance={chartSeries.monthlySalesPerformance}
              />

              <AdminSection
                id="closed-jobs"
                eyebrow="Begin Here"
                title="Log your first completed sale"
                description="One minute from the field. The moment you save, your command center comes alive."
                delay={0.1}
              >
                <ClosedJobsForm onLogged={() => void loadDashboard({ silent: true })} />
              </AdminSection>

              <AdminSection
                eyebrow="Platform Pulse"
                title="Living business metrics"
                description="Real numbers only — every metric starts at zero until you build it."
                delay={0.14}
              >
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {platformStatCards.map((card, index) => (
                    <AdminStatCard
                      key={card.label}
                      {...card}
                      index={index}
                      awaitingData
                    />
                  ))}
                </div>
              </AdminSection>
            </div>

            <aside className="mt-14 xl:sticky xl:top-10 xl:mt-0">{sidebar}</aside>
          </div>

          <motion.footer
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="mt-20 rounded-[1.5rem] border border-border/70 bg-surface/40 px-5 py-4 text-xs leading-relaxed text-muted sm:px-6"
          >
            Closed jobs: {dashboard.dataSources.closedJobs} · Executive stats:{" "}
            {dashboard.dataSources.executive} · Membership:{" "}
            {dashboard.dataSources.membership}.
          </motion.footer>
        </div>
      </div>
    );
  }

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
          {topBar}
        </motion.header>

        <div className="mt-10">
          <AdminCeoScoreboard scoreboard={scoreboard} />
        </div>

        <div className="mt-10">
          <RevenuePeriodFilterBar value={periodFilter} onChange={setPeriodFilter} />
        </div>

        <div className="mt-10">
          <AdminSection
            eyebrow="Growth Journey"
            title="Your path forward"
            description="Foundation to Legacy — each tier unlocks as the business earns it."
            delay={0.04}
          >
            <AdminGrowthJourney tiers={growthJourney} />
          </AdminSection>
        </div>

        <div className="mt-10 xl:grid xl:grid-cols-[1.42fr_0.88fr] xl:items-start xl:gap-12">
          <div className="space-y-10">
            <AdminSection
              eyebrow="Growth Trends"
              title="Revenue intelligence"
              description="Twelve-month trajectory across cash collected, ARR, and total sales performance."
              delay={0.06}
            >
              <AdminRevenueCharts
                revenueCollected={chartSeries.revenueCollected}
                arrGenerated={chartSeries.arrGenerated}
                monthlySalesPerformance={chartSeries.monthlySalesPerformance}
              />
            </AdminSection>

            <AdminSection
              eyebrow="Platform Pulse"
              title="Living business metrics"
              description={`${PERIOD_SECTION_LABELS[periodFilter]} — platform health alongside sales.`}
              delay={0.08}
            >
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {platformStatCards.map((card, index) => (
                  <AdminStatCard key={card.label} {...card} index={index} />
                ))}
              </div>
            </AdminSection>
          </div>

          <aside className="mt-10 xl:sticky xl:top-10 xl:mt-0">{sidebar}</aside>
        </div>

        <div className="mt-10 grid gap-6 xl:grid-cols-[1fr_1.1fr]">
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
            <MonthlySalesLedger
              entries={ledger}
              totalJobCount={dashboard.closedJobs.length}
            />
          </AdminSection>
        </div>

        <div className="mt-10">
          <AdminSection
            eyebrow="Recent Activity"
            title="Closed jobs"
            description="Every sale with immediate revenue and annual contract value."
            delay={0.16}
          >
            <RecentClosedJobsTable
              jobs={filteredJobs}
              totalJobCount={dashboard.closedJobs.length}
            />
          </AdminSection>
        </div>

        <div className="mt-10">
          <AdminSection
            eyebrow="Membership Revenue"
            title="Membership overview"
            description="Platform membership health. MRR remains a placeholder until Stripe connects."
            delay={0.18}
          >
            <MembershipRevenueSection membership={dashboard.membership} />
          </AdminSection>
        </div>

        <div className="mt-10 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
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
