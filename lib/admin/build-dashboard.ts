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

const EMPTY_PLATFORM_COUNTS = {
  activeMembers: 0,
  homeCarePlansCreated: 0,
  pendingRequests: 0,
  signedAgreements: 0,
};

const EMPTY_MEMBERSHIP: MembershipRevenueOverview = {
  active: 0,
  pending: 0,
  canceled: 0,
  estimatedMrr: 0,
  popularTier: "—",
  source: "supabase",
};

function countOrZero(value: number | null | undefined): number {
  return value ?? 0;
}

async function loadPlatformCounts(): Promise<{
  activeMembers: number;
  homeCarePlansCreated: number;
  pendingRequests: number;
  signedAgreements: number;
}> {
  if (!isSupabaseConfigured()) return EMPTY_PLATFORM_COUNTS;

  try {
    const supabase = createServerSupabaseClient();
    const [plansRes, agreementsRes, membershipsRes, leadsRes] = await Promise.all([
      supabase.from("home_care_plans").select("*", { count: "exact", head: true }),
      supabase.from("signed_agreements").select("*", { count: "exact", head: true }),
      supabase.from("memberships").select("status, plan_name"),
      supabase
        .from("lead_intakes")
        .select("*", { count: "exact", head: true })
        .eq("status", "new"),
    ]);

    return {
      activeMembers:
        membershipsRes.data?.filter((row) => row.status === "active").length ?? 0,
      homeCarePlansCreated: countOrZero(plansRes.count),
      pendingRequests: countOrZero(leadsRes.count),
      signedAgreements: countOrZero(agreementsRes.count),
    };
  } catch {
    return EMPTY_PLATFORM_COUNTS;
  }
}

async function loadMembershipOverview(): Promise<MembershipRevenueOverview> {
  if (!isSupabaseConfigured()) return EMPTY_MEMBERSHIP;

  try {
    const supabase = createServerSupabaseClient();
    const { data } = await supabase.from("memberships").select("status, plan_name");

    if (!data?.length) return EMPTY_MEMBERSHIP;

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
      estimatedMrr: 0,
      popularTier:
        Object.entries(tierCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—",
      source: "mixed",
    };
  } catch {
    return EMPTY_MEMBERSHIP;
  }
}

function resolveClosedJobsSource(
  supabaseCount: number,
  localCount: number,
): AdminDashboardData["dataSources"]["closedJobs"] {
  if (supabaseCount > 0 && localCount > 0) return "mixed";
  if (supabaseCount > 0) return "supabase";
  if (localCount > 0) return "local";
  return isSupabaseConfigured() ? "supabase" : "local";
}

function resolveStorage(
  supabaseCount: number,
  localCount: number,
): "supabase" | "local" {
  if (supabaseCount > 0) return "supabase";
  if (localCount > 0) return "local";
  return isSupabaseConfigured() ? "supabase" : "local";
}

export async function buildAdminDashboard(
  clientJobs: ClosedJob[] = [],
  privateBeta: boolean,
): Promise<AdminDashboardData> {
  const platformCounts = await loadPlatformCounts();
  const membership = await loadMembershipOverview();
  const supabaseJobs = await listClosedJobsFromSupabase();
  const closedJobs = mergeClosedJobs(supabaseJobs.jobs, clientJobs);
  const closedJobsSource = resolveClosedJobsSource(
    supabaseJobs.jobs.length,
    clientJobs.length,
  );
  const storage = resolveStorage(supabaseJobs.jobs.length, clientJobs.length);

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
      executive: closedJobsSource,
      membership: membership.source,
    },
    storage,
    supabaseConnected: isCloudPersistenceConnected(),
    privateBeta,
  };
}
