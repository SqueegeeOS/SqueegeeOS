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
  filterJobsByPeriod,
  mergeClosedJobs,
} from "@/lib/admin/sales-calculations";
import { clearAdminSession } from "@/lib/admin/pin";
import { ensureOsLaunchedDate } from "@/lib/admin/business-timeline";
import { computeCeoScoreboard } from "@/lib/admin/ceo-scoreboard";
import { computeCurrentMissions } from "@/lib/admin/current-mission";
import { filterOperatingSystemJobs } from "@/lib/admin/growth-journey";
import {
  EMPTY_LEGACY_BASELINE,
  type LegacyBaseline,
} from "@/lib/admin/legacy-baseline";
import { HEADQUARTERS_PURPOSE } from "@/lib/admin/company-philosophy";
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
import { AdminSection } from "./admin-section";
import { ClosedJobsForm } from "./closed-jobs-form";
import { MonthlySalesLedger } from "./monthly-sales-ledger";
import { RecentClosedJobsTable } from "./recent-closed-jobs-table";
import { RevenuePeriodFilterBar } from "./revenue-period-filter";
import { MorningBriefSection } from "./morning-brief";
import { HqFounderNav } from "./hq-founder-nav";
import { AmbientStage } from "@/components/craft/ambient-stage";
import { craftPrimaryButton } from "@/lib/craft/tokens";

const QUICK_ACTIONS = [
  { label: "New Presentation", href: ROUTES.newPresentation, primary: true },
  { label: "Care Plan Builder", href: ROUTES.hqCarePlanBuilder },
  { label: "Properties", href: ROUTES.properties },
  { label: "All Presentations", href: ROUTES.presentations },
  { label: "Production Check", href: ROUTES.hqProductionCheck },
] as const;

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

  const ledger = useMemo(
    () => computeMonthlyLedger(filteredJobs),
    [filteredJobs],
  );

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

  if (loading || !dashboard || !scoreboard || !morningBrief) {
    return <HeadquartersLoadingShell />;
  }

  const topBar = (
    <div className="flex flex-wrap items-center gap-3">
      {headquartersSync && (
        <HeadquartersCloudStatus sync={headquartersSync} />
      )}
      <LuxuryButton
        type="button"
        onClick={() => {
          clearAdminSession();
          window.location.reload();
        }}
        className="rounded-full border border-border/50 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:border-border hover:text-foreground"
      >
        Lock headquarters
      </LuxuryButton>
    </div>
  );

  const sidebar = (
    <div className="space-y-10">
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
      <AmbientStage>
      <AmbientFieldScoped variant="minimal">
        <div className="relative min-h-[100svh] overflow-x-hidden pb-24">
          <div className="relative mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-16 lg:px-10">
            <BootLayer layer="navigation" subtle>
              <header className="flex flex-col gap-8 border-b border-border/15 pb-12 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-muted/80">
                    Headquarters
                  </p>
                  <HeadlineReveal
                    as="h1"
                    mode="line"
                    text={headquartersWelcomeLine()}
                    className="mt-3 font-serif text-4xl font-light leading-[1.08] tracking-[-0.02em] text-foreground sm:text-5xl"
                    delay={motionProfile === "full" ? 0.1 : 0}
                  />
                  <LineReveal
                    className="mt-4 max-w-xl text-base leading-relaxed text-muted"
                    delay={motionProfile === "full" ? 0.22 : 0}
                  >
                    Review today&apos;s homes, members, and open work.
                  </LineReveal>
                </div>
                {topBar}
              </header>
              <div className="mt-8">
                <HqFounderNav
                  newCount={dashboard.executive.pendingRequests}
                />
              </div>
            </BootLayer>

            <div className="mt-14 xl:grid xl:grid-cols-[minmax(0,1fr)_17rem] xl:items-start xl:gap-16">
              <div className="space-y-16">
                <MorningBriefSection brief={morningBrief} />

                <AdminCeoScoreboard scoreboard={scoreboard} />

                <div
                  id="work"
                  className="grid gap-16 border-t border-border/15 pt-16 lg:grid-cols-2 lg:gap-12"
                >
                  <AdminSection
                    eyebrow="Field"
                    title="Log a completed sale"
                    description="A closed job from the field — totals refresh immediately."
                    index={0}
                  >
                    <ClosedJobsForm
                      onLogged={() => void loadDashboard({ silent: true })}
                    />
                  </AdminSection>

                  <AdminSection
                    eyebrow="Ledger"
                    title="Revenue by month"
                    description="Collected revenue and annual contract value for this period."
                    index={1}
                  >
                    <MonthlySalesLedger
                      entries={ledger}
                      totalJobCount={osClosedJobs.length}
                    />
                  </AdminSection>
                </div>

                <AdminSection
                  eyebrow="Activity"
                  title="Closed jobs"
                  description="Every sale logged in the Operating System."
                  index={0}
                >
                  <RevenuePeriodFilterBar
                    value={periodFilter}
                    onChange={setPeriodFilter}
                  />
                  <div className="mt-6">
                    <RecentClosedJobsTable
                      jobs={filteredJobs}
                      totalJobCount={osClosedJobs.length}
                    />
                  </div>
                </AdminSection>

                <AdminSection eyebrow="Go to" title="Open work" index={0}>
                  <div className="space-y-3">
                    {QUICK_ACTIONS.map((action) =>
                      "primary" in action && action.primary ? (
                        <Link
                          key={action.label}
                          href={action.href}
                          className={`inline-flex ${craftPrimaryButton} !min-h-[48px] !px-6 !text-sm !tracking-[0.04em]`}
                        >
                          {action.label}
                        </Link>
                      ) : (
                        <Link
                          key={action.label}
                          href={action.href}
                          className="block text-sm text-muted transition-colors duration-300 hover:text-foreground"
                        >
                          {action.label}
                        </Link>
                      ),
                    )}
                  </div>
                </AdminSection>
              </div>

              <aside className="mt-14 xl:sticky xl:top-12 xl:mt-0">
                {sidebar}
              </aside>
            </div>

            <BootLayer layer="footer" subtle>
              <footer className="mt-16 border-t border-border/15 pt-10">
                <p className="max-w-xl text-sm leading-relaxed text-muted/70 italic">
                  {HEADQUARTERS_PURPOSE}
                </p>
                <p className="mt-4 text-[10px] uppercase tracking-[0.2em] text-muted/50">
                  {PLATFORM_BRAND.poweredByLabel}
                </p>
              </footer>
            </BootLayer>
          </div>
        </div>
      </AmbientFieldScoped>
      </AmbientStage>
    </BootProvider>
  );
}
