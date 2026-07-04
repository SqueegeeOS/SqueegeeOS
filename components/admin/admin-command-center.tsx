"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
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
import { ensureOsLaunchedDate } from "@/lib/admin/business-timeline";
import { computeCeoScoreboard } from "@/lib/admin/ceo-scoreboard";
import { computeCurrentMissions } from "@/lib/admin/current-mission";
import { computeFreedomMeter } from "@/lib/admin/freedom-meter";
import {
  computeGrowthJourney,
  filterOperatingSystemJobs,
} from "@/lib/admin/growth-journey";
import {
  EMPTY_LEGACY_BASELINE,
  type LegacyBaseline,
} from "@/lib/admin/legacy-baseline";
import { HEADQUARTERS_PURPOSE } from "@/lib/admin/company-philosophy";
import { computeOsTimeline } from "@/lib/admin/os-timeline";
import { ROUTES } from "@/lib/navigation/config";
import type { HeadquartersSyncResult } from "@/lib/admin/headquarters-profile-client";
import { PLATFORM_BRAND } from "@/lib/brand/platform";
import { buildMorningBrief } from "@/lib/concierge/build-morning-brief";
import { toGoogleReviewsSnapshot } from "@/lib/concierge/rules";
import { useGoogleReviewsClient } from "@/lib/reviews/use-google-reviews-client";
import { AmbientFieldScoped } from "@/components/motion/ambient-field";
import { BootLayer } from "@/components/motion/boot-layer";
import { BootProvider } from "@/components/motion/boot-provider";
import { HeadquartersLoadingShell } from "@/components/motion/shimmer-block";
import { LuxuryButton } from "@/components/motion/status-pulse";
import {
  HeadlineReveal,
  LineReveal,
} from "@/components/motion/typography-reveal";
import {
  headquartersWelcomeLine,
  type MotionProfile,
} from "@/lib/motion/boot-sequence";
import {
  HeadquartersCloudStatus,
  HeadquartersStatusCard,
} from "./headquarters-cloud-status";
import { AdminCeoScoreboard } from "./admin-ceo-scoreboard";
import { AdminCockpitSidebar } from "./admin-cockpit-sidebar";
import { AdminCurrentMission } from "./admin-current-mission";
import { AdminDualTimelines } from "./admin-dual-timelines";
import { AdminFreedomMeter } from "./admin-freedom-meter";
import { AdminGrowthJourney } from "./admin-growth-journey";
import { AdminLiveGoogleReviews } from "./admin-live-google-reviews";
import { AdminLegacyHonorCard } from "./admin-legacy-honor-card";
import { AdminRevenueCharts } from "./admin-revenue-charts";
import { AdminSection } from "./admin-section";
import { AdminStatCard } from "./admin-stat-card";
import { ClosedJobsForm } from "./closed-jobs-form";
import { FounderJournal } from "./founder-journal";
import { MembershipRevenueSection } from "./membership-revenue-section";
import { MonthlySalesLedger } from "./monthly-sales-ledger";
import { RecentClosedJobsTable } from "./recent-closed-jobs-table";
import { RevenuePeriodFilterBar } from "./revenue-period-filter";
import { WhyWeExist } from "./why-we-exist";
import { MorningBriefSection } from "./morning-brief";

export function AdminCommandCenter({
  initialLegacyBaseline,
  headquartersSync,
  motionProfile = "none",
}: {
  initialLegacyBaseline?: LegacyBaseline | null;
  headquartersSync?: HeadquartersSyncResult | null;
  motionProfile?: MotionProfile;
}) {
  const { response: googleReviewsResponse } = useGoogleReviewsClient();
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [periodFilter, setPeriodFilter] =
    useState<RevenuePeriodFilter>("current_month");
  const [loading, setLoading] = useState(true);
  const [legacyBaseline, setLegacyBaseline] =
    useState<LegacyBaseline>(EMPTY_LEGACY_BASELINE);

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
    if (initialLegacyBaseline) {
      setLegacyBaseline(initialLegacyBaseline);
    }
  }, [initialLegacyBaseline]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const osClosedJobs = useMemo(() => {
    if (!dashboard) return [];
    return filterOperatingSystemJobs(
      dashboard.closedJobs,
      ensureOsLaunchedDate(),
    );
  }, [dashboard]);

  const filteredJobs = useMemo(() => {
    return filterJobsByPeriod(osClosedJobs, periodFilter);
  }, [osClosedJobs, periodFilter]);

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
    return computeRevenueChartSeries(osClosedJobs);
  }, [dashboard, osClosedJobs]);

  const operatingContext = useMemo(() => {
    if (!dashboard) return null;
    return {
      closedJobs: dashboard.closedJobs,
      activeMembers: dashboard.executive.activeMembers,
      homeCarePlansCreated: dashboard.executive.homeCarePlansCreated,
      pendingRequests: dashboard.executive.pendingRequests,
      legacyBaseline,
      osLaunchedDate: ensureOsLaunchedDate(),
    };
  }, [dashboard, legacyBaseline]);

  const scoreboard = useMemo(() => {
    if (!operatingContext) return null;
    return computeCeoScoreboard(operatingContext);
  }, [operatingContext]);

  const growthJourney = useMemo(() => {
    if (!operatingContext) return null;
    return computeGrowthJourney(operatingContext);
  }, [operatingContext]);

  const missions = useMemo(() => {
    if (!operatingContext) return [];
    return computeCurrentMissions(operatingContext);
  }, [operatingContext]);

  const morningBrief = useMemo(() => {
    if (!dashboard || !operatingContext) return null;

    return buildMorningBrief({
      operatingContext,
      dashboard,
      googleReviews: toGoogleReviewsSnapshot(
        googleReviewsResponse?.status,
        googleReviewsResponse?.data ?? null,
      ),
      missions,
    });
  }, [dashboard, googleReviewsResponse, missions, operatingContext]);

  const freedomMeter = useMemo(() => {
    if (!operatingContext || !scoreboard) return null;
    return computeFreedomMeter(operatingContext, scoreboard.ledger);
  }, [operatingContext, scoreboard]);

  const osTimeline = useMemo(() => {
    if (!dashboard) return [];
    return computeOsTimeline({
      osLaunchedDate: ensureOsLaunchedDate(),
      closedJobs: dashboard.closedJobs,
      homeCarePlansCreated: dashboard.executive.homeCarePlansCreated,
      signedAgreements: dashboard.executive.signedAgreements,
    });
  }, [dashboard]);

  if (loading || !dashboard || !stats || !chartSeries || !scoreboard || !growthJourney || !freedomMeter) {
    return <HeadquartersLoadingShell />;
  }

  const showOsAwaitingBanner =
    scoreboard.ledger.operatingSystem.closedJobsCount === 0;

  const platformStatCards = [
    {
      label: "Revenue Collected",
      value: formatCurrency(stats.revenueCollected),
      detail: "Operating System · this period",
    },
    {
      label: "ARR Generated",
      value: formatCurrency(stats.arrGenerated),
      detail: "Operating System · this period",
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
    { label: "Pricing Calculator", href: ROUTES.hqPricing },
    { label: "New Presentation", href: ROUTES.newPresentation },
    { label: "All Presentations", href: ROUTES.presentations },
    { label: "Our Story", href: ROUTES.hqOurStory },
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
      {headquartersSync && (
        <HeadquartersCloudStatus sync={headquartersSync} />
      )}
      <span className="rounded-full border border-border px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-muted">
        {dashboard.storage === "supabase" ? "Cloud ledger" : "Local ledger"}
      </span>
      {dashboard.privateBeta && (
        <span className="rounded-full border border-accent/25 bg-accent/[0.06] px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-accent">
          Private beta
        </span>
      )}
      <LuxuryButton
        type="button"
        onClick={() => {
          clearAdminSession();
          window.location.reload();
        }}
        className="rounded-full border border-border px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:border-accent/30 hover:text-accent"
      >
        Lock headquarters
      </LuxuryButton>
    </div>
  );

  const sidebar = (
    <div className="space-y-6">
      {headquartersSync && (
        <HeadquartersStatusCard
          sync={headquartersSync}
          baseline={legacyBaseline}
        />
      )}
      <AdminCockpitSidebar legacyBaseline={legacyBaseline} />
    </div>
  );

  return (
    <BootProvider profile={motionProfile}>
      <AmbientFieldScoped variant="minimal">
        <div className="relative min-h-[100svh] overflow-x-hidden pb-24">
          <div className="relative mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14 lg:px-10">
            <BootLayer layer="navigation" subtle>
              <header className="flex flex-col gap-6 border-b border-border/70 pb-10 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.32em] text-muted">
                    SqueegeeKing Headquarters
                  </p>
                  <p className="mt-2 text-[10px] uppercase tracking-[0.22em] text-muted/60">
                    {PLATFORM_BRAND.poweredByLabel}
                  </p>
                  <HeadlineReveal
                    as="h1"
                    mode="line"
                    text={headquartersWelcomeLine()}
                    className="mt-4 font-serif text-4xl font-light leading-[1.05] text-foreground sm:text-6xl"
                    delay={motionProfile === "full" ? 0.1 : 0}
                  />
                  <LineReveal
                    className="mt-4 max-w-2xl text-base leading-relaxed text-muted sm:text-lg"
                    delay={motionProfile === "full" ? 0.22 : 0}
                  >
                    Your company is alive. Let&apos;s continue building it
                    today.
                  </LineReveal>
                  {showOsAwaitingBanner && (
                    <p className="mt-4 text-sm text-muted/80">
                      The Operating System is ready for its first logged sale.
                    </p>
                  )}
                </div>
                {topBar}
              </header>
            </BootLayer>

        <div className="mt-10">
          <Link
            href={ROUTES.hqPricing}
            className="group flex flex-col gap-2 rounded-[1.75rem] border border-accent/25 bg-accent/[0.05] px-6 py-5 transition-colors hover:border-accent/40 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-accent">
                Pricing Calculator
              </p>
              <p className="mt-2 text-sm text-muted">
                Quarterly and bi-annual base rates by sq ft — exterior, inside +
                out, and one-time pricing. Screens never included.
              </p>
            </div>
            <span className="text-sm text-accent transition-transform group-hover:translate-x-0.5">
              Open sheet →
            </span>
          </Link>
        </div>

        {morningBrief && (
          <div className="mt-10">
            <MorningBriefSection brief={morningBrief} />
          </div>
        )}

        <div className="mt-10">
          <WhyWeExist />
        </div>

        <div className="mt-14">
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted">
            Where did we come from?
          </p>
          <div className="mt-6">
            <AdminLegacyHonorCard
              baseline={legacyBaseline}
              onSaved={setLegacyBaseline}
            />
          </div>
        </div>

        <div className="mt-14">
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted">
            Where are we today?
          </p>
          <div className="mt-6 space-y-6">
            <AdminCeoScoreboard scoreboard={scoreboard} />
            <AdminLiveGoogleReviews />
          </div>
        </div>

        <div className="mt-14">
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted">
            Where are we going?
          </p>
          <div className="mt-6 grid gap-6 xl:grid-cols-3">
            <AdminCurrentMission missions={missions} />
            <AdminSection
              eyebrow="Growth Journey"
              title="The path forward"
              description="Foundation to Dynasty — milestones unlock as the business earns them."
              index={1}
            >
              <AdminGrowthJourney tiers={growthJourney} />
            </AdminSection>
            <AdminFreedomMeter meter={freedomMeter} />
          </div>
        </div>

        <div className="mt-14 xl:grid xl:grid-cols-[1.42fr_0.88fr] xl:items-start xl:gap-12">
          <div className="space-y-10">
            <AdminSection
              eyebrow="The Operating System"
              title="Today — alive"
              description="Numbers change. Charts move. Goals progress. This is the company right now."
              index={0}
            >
              <div className="space-y-8">
                <RevenuePeriodFilterBar
                  value={periodFilter}
                  onChange={setPeriodFilter}
                />
                <AdminRevenueCharts
                  revenueCollected={chartSeries.revenueCollected}
                  arrGenerated={chartSeries.arrGenerated}
                  monthlySalesPerformance={chartSeries.monthlySalesPerformance}
                />
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {platformStatCards.map((card, index) => (
                    <AdminStatCard key={card.label} {...card} index={index} />
                  ))}
                </div>
              </div>
            </AdminSection>

            <AdminSection
              eyebrow="Two Timelines"
              title="History and today"
              description="The Legacy is preserved. The Operating System is tracked live."
              index={1}
            >
              <AdminDualTimelines
                legacyMilestones={legacyBaseline.legacyMilestones}
                osEvents={osTimeline}
              />
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
            index={0}
          >
            <ClosedJobsForm onLogged={() => void loadDashboard({ silent: true })} />
          </AdminSection>

          <AdminSection
            eyebrow="Monthly Sales Ledger"
            title="Revenue by month"
            description="Revenue collected, ARR generated, and monthly sales performance for the selected period."
            index={1}
          >
            <MonthlySalesLedger
              entries={ledger}
              totalJobCount={osClosedJobs.length}
            />
          </AdminSection>
        </div>

        <div className="mt-10">
          <AdminSection
            eyebrow="Recent Activity"
            title="Closed jobs"
            description="Every sale with immediate revenue and annual contract value."
            index={0}
          >
            <RecentClosedJobsTable
              jobs={filteredJobs}
              totalJobCount={osClosedJobs.length}
            />
          </AdminSection>
        </div>

        <div className="mt-10">
          <AdminSection
            eyebrow="Membership Revenue"
            title="Membership overview"
            description="Platform membership health. MRR remains a placeholder until Stripe connects."
            index={0}
          >
            <MembershipRevenueSection membership={dashboard.membership} />
          </AdminSection>
        </div>

        <div className="mt-14">
          <FounderJournal />
        </div>

        <div className="mt-10">
          <AdminSection eyebrow="Quick Actions" title="Move with intent" index={0}>
            <div className="grid gap-3 sm:grid-cols-2">
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

        <BootLayer layer="footer" subtle>
          <footer className="mt-10 space-y-4 rounded-[1.5rem] border border-border/70 bg-surface/40 px-5 py-4 text-xs leading-relaxed text-muted sm:px-6">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted/50">
              {PLATFORM_BRAND.poweredByLabel}
            </p>
            <p className="max-w-2xl text-muted/60 italic">
              {HEADQUARTERS_PURPOSE}
            </p>
            <p>
              Closed jobs: {dashboard.dataSources.closedJobs} · Executive stats:{" "}
              {dashboard.dataSources.executive} · Membership:{" "}
              {dashboard.dataSources.membership}. Supabase table: run{" "}
              <code className="rounded bg-background px-1.5 py-0.5 text-accent">
                lib/persistence/supabase/migrations/002_closed_jobs.sql
              </code>{" "}
              in the SQL Editor for cloud persistence.
            </p>
          </footer>
        </BootLayer>
          </div>
        </div>
      </AmbientFieldScoped>
    </BootProvider>
  );
}
