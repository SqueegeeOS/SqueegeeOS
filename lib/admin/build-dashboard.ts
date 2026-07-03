import { MOCK_INCOMING_REQUESTS } from "@/lib/admin/mock-data";
import { MOCK_CLOSED_JOBS } from "@/lib/admin/mock-closed-jobs";
import type {
  AdminDashboardData,
  ClosedJob,
  MembershipRevenueOverview,
} from "@/lib/admin/closed-jobs-types";
import {
  computeExecutiveStats,
  computeMonthlyLedger,
  filterJobsByPeriod,
  mergeClosedJobs,
} from "@/lib/admin/sales-calculations";
import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import {
  createServerSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";
import { listClosedJobsFromSupabase } from "./closed-jobs-server";

function countOrZero(value: number | null | undefined): number {
  return value ?? 0;
}

async function loadPlatformCounts(): Promise<{
  activeMembers: number;
  homeCarePlansCreated: number;
  pendingRequests: number;
  signedAgreements: number;
}> {
  const defaults = {
    activeMembers: 2,
    homeCarePlansCreated: 3,
    pendingRequests: MOCK_INCOMING_REQUESTS.filter((r) => r.status === "new")
      .length,
    signedAgreements: 2,
  };

  if (!isSupabaseConfigured()) return defaults;

  try {
    const supabase = createServerSupabaseClient();
    const [plansRes, agreementsRes, membershipsRes] = await Promise.all([
      supabase.from("home_care_plans").select("*", { count: "exact", head: true }),
      supabase.from("signed_agreements").select("*", { count: "exact", head: true }),
      supabase.from("memberships").select("status, plan_name"),
    ]);

    const activeMembers =
      membershipsRes.data?.filter((row) => row.status === "active").length ?? 0;

    return {
      activeMembers: activeMembers || defaults.activeMembers,
      homeCarePlansCreated:
        countOrZero(plansRes.count) || defaults.homeCarePlansCreated,
      pendingRequests: defaults.pendingRequests,
      signedAgreements:
        countOrZero(agreementsRes.count) || defaults.signedAgreements,
    };
  } catch {
    return defaults;
  }
}

async function loadMembershipOverview(): Promise<MembershipRevenueOverview> {
  const fallback: MembershipRevenueOverview = {
    active: 2,
    pending: 1,
    canceled: 0,
    estimatedMrr: 1840,
    popularTier: "Preferred Membership",
    source: "mock",
  };

  if (!isSupabaseConfigured()) return fallback;

  try {
    const supabase = createServerSupabaseClient();
    const { data } = await supabase.from("memberships").select("status, plan_name");

    if (!data?.length) return fallback;

    const tierCounts = data.reduce<Record<string, number>>((acc, row) => {
      const key = row.plan_name ?? "Unknown";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    return {
      active: data.filter((row) => row.status === "active").length,
      pending: data.filter(
        (row) => row.status === "pending_checkout" || row.status === "inactive",
      ).length,
      canceled: data.filter((row) => row.status === "cancelled").length,
      estimatedMrr: fallback.estimatedMrr,
      popularTier:
        Object.entries(tierCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ??
        fallback.popularTier,
      source: "mixed",
    };
  } catch {
    return fallback;
  }
}

export async function buildAdminDashboard(
  clientJobs: ClosedJob[] = [],
  privateBeta: boolean,
): Promise<AdminDashboardData> {
  const platformCounts = await loadPlatformCounts();
  const membership = await loadMembershipOverview();
  const supabaseJobs = await listClosedJobsFromSupabase();

  let closedJobs: ClosedJob[];
  let storage: "supabase" | "local";
  let closedJobsSource: AdminDashboardData["dataSources"]["closedJobs"];

  if (supabaseJobs.jobs.length > 0) {
    closedJobs = mergeClosedJobs(supabaseJobs.jobs, clientJobs);
    storage = "supabase";
    closedJobsSource = clientJobs.length > 0 ? "mixed" : "supabase";
  } else if (clientJobs.length > 0) {
    closedJobs = mergeClosedJobs(clientJobs, MOCK_CLOSED_JOBS);
    storage = "local";
    closedJobsSource = "mixed";
  } else {
    closedJobs = MOCK_CLOSED_JOBS;
    storage = "local";
    closedJobsSource = "mock";
  }

  const currentMonthJobs = filterJobsByPeriod(closedJobs, "current_month");
  const executive = computeExecutiveStats(currentMonthJobs, platformCounts);
  const monthlyLedger = computeMonthlyLedger(currentMonthJobs);

  return {
    executive,
    closedJobs,
    monthlyLedger,
    membership,
    dataSources: {
      closedJobs: closedJobsSource,
      executive: closedJobsSource === "mock" ? "mock" : "mixed",
      membership: membership.source,
    },
    storage,
    supabaseConnected: isCloudPersistenceConnected(),
    privateBeta,
  };
}
