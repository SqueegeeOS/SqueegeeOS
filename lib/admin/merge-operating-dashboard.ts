import type { AdminDashboardData, ClosedJob } from "@/lib/admin/closed-jobs-types";
import { loadLocalClosedJobs } from "@/lib/admin/closed-jobs-store";
import {
  computeExecutiveStats,
  computeMonthlyLedger,
  filterJobsByPeriod,
  mergeClosedJobs,
} from "@/lib/admin/sales-calculations";

/** Merge HQ overview payload with any closed jobs logged on this device. */
export function mergeOperatingDashboard(
  serverData: AdminDashboardData,
  localJobs: ClosedJob[],
): AdminDashboardData {
  const closedJobs = mergeClosedJobs(serverData.closedJobs, localJobs);
  const currentMonthJobs = filterJobsByPeriod(closedJobs, "current_month");

  return {
    ...serverData,
    closedJobs,
    executive: computeExecutiveStats(currentMonthJobs, {
      activeMembers: serverData.executive.activeMembers,
      homeCarePlansCreated: serverData.executive.homeCarePlansCreated,
      pendingRequests: serverData.executive.pendingRequests,
      signedAgreements: serverData.executive.signedAgreements,
    }),
    monthlyLedger: computeMonthlyLedger(currentMonthJobs),
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
        localJobs.length > 0 && serverData.dataSources.executive !== "local"
          ? "mixed"
          : localJobs.length > 0
            ? "local"
            : serverData.dataSources.executive,
    },
  };
}

export function buildLocalFallbackDashboard(): AdminDashboardData {
  const localJobs = loadLocalClosedJobs();
  const closedJobs = mergeClosedJobs([], localJobs);
  const currentMonthJobs = filterJobsByPeriod(closedJobs, "current_month");

  return {
    executive: computeExecutiveStats(currentMonthJobs),
    closedJobs,
    monthlyLedger: computeMonthlyLedger(currentMonthJobs),
    membership: {
      active: 0,
      pending: 0,
      canceled: 0,
      estimatedMrr: 0,
      popularTier: "—",
      source: "supabase",
    },
    membershipProductionRevenue: {
      membersSignedToday: 0,
      membersSignedThisMonth: 0,
      cardOnFileCount: 0,
      membersOnBook: 0,
      activeMembershipValue: 0,
      expectedYearlyMembershipRevenue: 0,
      addonRevenueCollected: 0,
      totalCustomerRevenue: 0,
      recentSignings: [],
      source: "unavailable",
    },
    websiteMembershipSales: {
      todayCount: 0,
      monthCount: 0,
      todayAnnualizedValue: 0,
      monthAnnualizedValue: 0,
      totalAnnualizedValue: 0,
      recentSales: [],
      source: "unavailable",
    },
    dataSources: {
      closedJobs: localJobs.length > 0 ? "local" : "supabase",
      executive: localJobs.length > 0 ? "local" : "supabase",
      membership: "supabase",
      membershipProductionRevenue: "unavailable",
      websiteMembershipSales: "unavailable",
    },
    storage: "local",
    supabaseConnected: false,
    privateBeta: true,
  };
}
