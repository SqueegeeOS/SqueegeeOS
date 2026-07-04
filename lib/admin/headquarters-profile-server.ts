import {
  DEFAULT_FOUNDERS,
  EMPTY_LEGACY_BASELINE,
  isHeadquartersInitialized,
  legacyBaselineHasHistory,
  normalizeLegacyBaseline,
  type LegacyBaseline,
  type LegacyMilestone,
} from "@/lib/admin/legacy-baseline";
import {
  createServerSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";

export const HEADQUARTERS_PROFILE_ID = "squeegeeking";

export interface HeadquartersProfileRow {
  id: string;
  business_started_date: string | null;
  google_reviews_baseline: number;
  homes_served_baseline: number;
  lifetime_revenue_baseline: number;
  largest_month: string;
  largest_job: string;
  current_recurring_customers: number;
  about_noah: string;
  about_dasan: string;
  company_stand_for: string;
  onboarding_complete: boolean;
  headquarters_initialized?: boolean;
  founders: [string, string];
  legacy_milestones: LegacyMilestone[];
  portrait_noah: string | null;
  portrait_dasan: string | null;
  lifetime_arr: number;
  closed_jobs_count: number;
  memberships_sold: number;
  active_members: number;
  has_employee: boolean;
  has_company_truck: boolean;
  multi_city_expansion: boolean;
  configured: boolean;
  updated_at: string;
}

export function isBlankHeadquartersProfile(baseline: LegacyBaseline): boolean {
  return !isHeadquartersInitialized(baseline) && !legacyBaselineHasHistory(baseline);
}

export function baselineToRow(baseline: LegacyBaseline): HeadquartersProfileRow {
  const normalized = normalizeLegacyBaseline({
    ...baseline,
    configured: true,
    fiveStarReviews: baseline.googleReviews,
    homesProtected: baseline.homesServed,
    activeMembers: baseline.recurringCustomers || baseline.activeMembers,
    updatedAt: baseline.updatedAt ?? new Date().toISOString(),
  });

  return {
    id: HEADQUARTERS_PROFILE_ID,
    business_started_date: normalized.companyFoundedDate,
    google_reviews_baseline: normalized.googleReviews,
    homes_served_baseline: normalized.homesServed,
    lifetime_revenue_baseline: normalized.lifetimeRevenue,
    largest_month: normalized.largestMonth,
    largest_job: normalized.largestJob,
    current_recurring_customers: normalized.recurringCustomers,
    about_noah: normalized.aboutNoah,
    about_dasan: normalized.aboutDasan,
    company_stand_for: normalized.companyStandFor,
    onboarding_complete: normalized.onboardingComplete,
    headquarters_initialized: isHeadquartersInitialized(normalized),
    founders: normalized.founders,
    legacy_milestones: normalized.legacyMilestones,
    portrait_noah: normalized.portraitNoah,
    portrait_dasan: normalized.portraitDasan,
    lifetime_arr: normalized.lifetimeArr,
    closed_jobs_count: normalized.closedJobs,
    memberships_sold: normalized.membershipsSold,
    active_members: normalized.activeMembers,
    has_employee: normalized.hasEmployee,
    has_company_truck: normalized.hasCompanyTruck,
    multi_city_expansion: normalized.multiCityExpansion,
    configured: normalized.configured,
    updated_at: normalized.updatedAt ?? new Date().toISOString(),
  };
}

export function rowToBaseline(row: HeadquartersProfileRow): LegacyBaseline {
  return normalizeLegacyBaseline({
    configured: row.configured,
    onboardingComplete: row.onboarding_complete,
    headquartersInitialized: row.headquarters_initialized ?? row.onboarding_complete,
    companyFoundedDate: row.business_started_date,
    founders: row.founders,
    googleReviews: row.google_reviews_baseline,
    lifetimeRevenue: Number(row.lifetime_revenue_baseline),
    homesServed: row.homes_served_baseline,
    largestMonth: row.largest_month,
    largestJob: row.largest_job,
    recurringCustomers: row.current_recurring_customers,
    aboutNoah: row.about_noah,
    aboutDasan: row.about_dasan,
    companyStandFor: row.company_stand_for,
    portraitNoah: row.portrait_noah,
    portraitDasan: row.portrait_dasan,
    legacyMilestones: row.legacy_milestones ?? [],
    lifetimeArr: Number(row.lifetime_arr),
    closedJobs: row.closed_jobs_count,
    membershipsSold: row.memberships_sold,
    activeMembers: row.active_members,
    fiveStarReviews: row.google_reviews_baseline,
    homesProtected: row.homes_served_baseline,
    hasEmployee: row.has_employee,
    hasCompanyTruck: row.has_company_truck,
    multiCityExpansion: row.multi_city_expansion,
    updatedAt: row.updated_at,
  });
}

function isMissingTableError(message: string, code?: string): boolean {
  return (
    message.includes("does not exist") ||
    message.includes("headquarters_profile") ||
    code === "PGRST205"
  );
}

export async function fetchHeadquartersProfileFromSupabase(): Promise<{
  profile: LegacyBaseline | null;
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { profile: null, error: "Supabase not configured" };
  }

  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("headquarters_profile")
      .select("*")
      .eq("id", HEADQUARTERS_PROFILE_ID)
      .maybeSingle();

    if (error) {
      if (isMissingTableError(error.message, error.code)) {
        return {
          profile: null,
          error: "headquarters_profile table missing — run Cloud Headquarters setup",
        };
      }
      return { profile: null, error: error.message };
    }

    if (!data) {
      return { profile: null };
    }

    const row = data as HeadquartersProfileRow;
    const baseline = rowToBaseline(row);
    if (isBlankHeadquartersProfile(baseline)) {
      return { profile: null };
    }

    return { profile: baseline };
  } catch (error) {
    return {
      profile: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function upsertHeadquartersProfileToSupabase(
  baseline: LegacyBaseline,
): Promise<{ profile: LegacyBaseline | null; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { profile: null, error: "Supabase not configured" };
  }

  if (isBlankHeadquartersProfile(baseline)) {
    return { profile: null, error: "Refusing to save an empty headquarters profile" };
  }

  const row = baselineToRow(baseline);

  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("headquarters_profile")
      .upsert(row, { onConflict: "id" })
      .select("*")
      .single();

    if (error) {
      if (isMissingTableError(error.message, error.code)) {
        return {
          profile: null,
          error: "headquarters_profile table missing — run Cloud Headquarters setup",
        };
      }
      return { profile: null, error: error.message };
    }

    return { profile: rowToBaseline(data as HeadquartersProfileRow) };
  } catch (error) {
    return {
      profile: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export function compareProfileUpdatedAt(
  left: string | null | undefined,
  right: string | null | undefined,
): number {
  const leftTime = left ? Date.parse(left) : 0;
  const rightTime = right ? Date.parse(right) : 0;
  return leftTime - rightTime;
}

export function pickNewerBaseline(
  cloud: LegacyBaseline | null,
  local: LegacyBaseline,
): LegacyBaseline {
  if (!cloud) return local;
  if (isBlankHeadquartersProfile(local)) return cloud;
  if (compareProfileUpdatedAt(local.updatedAt, cloud.updatedAt) > 0) {
    return local;
  }
  return cloud;
}

export function emptyCloudBaseline(): LegacyBaseline {
  return { ...EMPTY_LEGACY_BASELINE };
}
