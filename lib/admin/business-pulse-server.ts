import "server-only";

import {
  createServerSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";
import {
  buildBusinessPulseSnapshot,
  resolveBusinessPulseRange,
  type BusinessPulseAddonRow,
  type BusinessPulseAgreementRow,
  type BusinessPulseBillingChargeRow,
  type BusinessPulseJobRow,
  type BusinessPulseLeadRow,
  type BusinessPulseMembershipRow,
  type BusinessPulseMonthlyJobRow,
  type BusinessPulsePeriod,
  type BusinessPulsePropertyLinkRow,
  type BusinessPulseSnapshot,
} from "./business-pulse";

const JOB_LIMIT = 5_000;
const HISTORICAL_JOB_LIMIT = 10_000;
const ROW_LIMIT = 2_000;

function unavailableSnapshot(
  preset: BusinessPulsePeriod,
  warning: string,
): BusinessPulseSnapshot {
  const range = resolveBusinessPulseRange(preset);
  const currentYear = Number(
    resolveBusinessPulseRange("year").startCalendarDate.slice(0, 4),
  );
  const emptySource = {
    label: "Unavailable",
    status: "attention" as const,
    lastEventAt: null,
    detail: warning,
  };
  return {
    generatedAt: new Date().toISOString(),
    source: "unavailable",
    range,
    metrics: {
      paidWorkValueCents: 0,
      completedWorkValueCents: 0,
      bookedWorkValueCents: 0,
      membershipPaidWorkValueCents: 0,
      unclassifiedPaidWorkValueCents: 0,
      homeAtlasMembershipCollectedCents: 0,
      activeArrCents: 0,
      arrAddedCents: 0,
      activeMembers: 0,
      membershipsSold: 0,
      leads: 0,
      jobsBooked: 0,
      jobsCompleted: 0,
      jobsMarkedPaid: 0,
      classifiedJobs: 0,
      unclassifiedJobs: 0,
    },
    monthlyRevenue: {
      currentYear,
      years: [currentYear],
      points: [],
      earliestRecordedMonth: null,
      earliestArrMonth: null,
    },
    leadMix: [],
    recentJobs: [],
    recentMembershipSales: [],
    sources: {
      homeAtlas: { ...emptySource, label: "HomeAtlas" },
      jobber: { ...emptySource, label: "Jobber" },
      stripe: { ...emptySource, label: "Stripe" },
      goHighLevel: {
        label: "GoHighLevel",
        status: "not_connected",
        lastEventAt: null,
        detail: "Optional attribution layer.",
      },
    },
    warnings: [warning],
    definitions: [],
  };
}

function latestIso(values: Array<string | null | undefined>): string | null {
  return (
    values
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => b.localeCompare(a))[0] ?? null
  );
}

export async function loadBusinessPulseSnapshot(
  preset: BusinessPulsePeriod,
): Promise<BusinessPulseSnapshot> {
  if (!isSupabaseConfigured()) {
    return unavailableSnapshot(preset, "Supabase is not configured in this environment.");
  }

  const range = resolveBusinessPulseRange(preset);
  const supabase = createServerSupabaseClient();
  const [
    jobsResult,
    historicalJobsResult,
    membershipsResult,
    agreementsResult,
    propertyLinksResult,
    billingChargesResult,
    addonsResult,
    leadsResult,
    connectionResult,
    latestJobberResult,
    stripeEventsResult,
  ] = await Promise.all([
    supabase
      .from("jobber_visit_projections")
      .select(
        "external_job_id, external_property_id, job_number, title, client_name, scheduled_start, is_complete, job_total_cents, visit_invoice_status, source_observed_at, updated_at",
      )
      .gte("scheduled_start", range.startUtc)
      .lt("scheduled_start", range.endUtc)
      .order("scheduled_start", { ascending: false })
      .limit(JOB_LIMIT),
    supabase
      .from("jobber_visit_projections")
      .select(
        "external_job_id, scheduled_start, job_total_cents, visit_invoice_status",
      )
      .not("scheduled_start", "is", null)
      .order("scheduled_start", { ascending: true })
      .limit(HISTORICAL_JOB_LIMIT),
    supabase
      .from("memberships")
      .select(
        "id, property_id, agreement_id, status, annual_rate, visit_price, visits_per_year, payment_setup_completed_at, stripe_payment_method_id, stripe_customer_id, payment_rail, manual_payment_approved_at, manual_payment_approved_by",
      )
      .limit(ROW_LIMIT),
    supabase
      .from("signed_agreements")
      .select("id, membership_id, homeowner_name, signed_at")
      .order("signed_at", { ascending: false })
      .limit(ROW_LIMIT),
    supabase
      .from("jobber_property_links")
      .select("external_property_id, membership_id, property_id, link_state")
      .eq("link_state", "active")
      .limit(ROW_LIMIT),
    supabase
      .from("membership_billing_charges")
      .select("status, amount, amount_collected, charged_at")
      .in("status", ["paid", "charged"])
      .gte("charged_at", range.startUtc)
      .lt("charged_at", range.endUtc)
      .limit(ROW_LIMIT),
    supabase
      .from("member_addon_transactions")
      .select("status, amount_charged_cents, service_date")
      .gte("service_date", range.startCalendarDate)
      .lt("service_date", range.endCalendarDateExclusive)
      .limit(ROW_LIMIT),
    supabase
      .from("lead_intakes")
      .select("source, submitted_at")
      .gte("submitted_at", range.startUtc)
      .lt("submitted_at", range.endUtc)
      .limit(ROW_LIMIT),
    supabase
      .from("jobber_connections")
      .select("status, last_verified_at, last_refreshed_at, updated_at")
      .eq("id", "squeegeeking")
      .maybeSingle(),
    supabase
      .from("jobber_visit_projections")
      .select("source_observed_at, updated_at")
      .order("source_observed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("stripe_event_ledger")
      .select("received_at, processing_error")
      .order("received_at", { ascending: false })
      .limit(100),
  ]);

  const warningEntries: Array<[string, string | undefined]> = [
    ["Jobber jobs", jobsResult.error?.message],
    ["Jobber historical revenue", historicalJobsResult.error?.message],
    ["memberships", membershipsResult.error?.message],
    ["signed agreements", agreementsResult.error?.message],
    ["Jobber property links", propertyLinksResult.error?.message],
    ["membership charges", billingChargesResult.error?.message],
    ["member add-ons", addonsResult.error?.message],
    ["lead intakes", leadsResult.error?.message],
    ["Jobber connection", connectionResult.error?.message],
    ["Jobber freshness", latestJobberResult.error?.message],
    ["Stripe event ledger", stripeEventsResult.error?.message],
  ];
  const warnings = warningEntries
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([label, message]) => `${label} could not load: ${message}`);
  if ((jobsResult.data?.length ?? 0) >= JOB_LIMIT) {
    warnings.push(
      `Jobber reached the ${JOB_LIMIT.toLocaleString()}-row safety limit for this period; narrow the date filter before treating totals as complete.`,
    );
  }
  if ((historicalJobsResult.data?.length ?? 0) >= HISTORICAL_JOB_LIMIT) {
    warnings.push(
      `Jobber historical revenue reached the ${HISTORICAL_JOB_LIMIT.toLocaleString()}-row safety limit; older monthly totals may be partial.`,
    );
  }
  if (
    [
      membershipsResult.data?.length,
      agreementsResult.data?.length,
      propertyLinksResult.data?.length,
      billingChargesResult.data?.length,
      addonsResult.data?.length,
      leadsResult.data?.length,
    ].some((count) => Number(count ?? 0) >= ROW_LIMIT)
  ) {
    warnings.push(
      `A HomeAtlas source reached the ${ROW_LIMIT.toLocaleString()}-row safety limit; totals may be partial for this period.`,
    );
  }

  const connection = connectionResult.data as
    | {
        status: string;
        last_verified_at: string | null;
        last_refreshed_at: string | null;
        updated_at: string;
      }
    | null;
  const latestJobber = latestJobberResult.data as
    | { source_observed_at: string | null; updated_at: string }
    | null;
  const stripeEvents = (stripeEventsResult.data ?? []) as Array<{
    received_at: string;
    processing_error: string | null;
  }>;

  return buildBusinessPulseSnapshot({
    range,
    jobs: (jobsResult.data ?? []) as BusinessPulseJobRow[],
    historicalJobs: (historicalJobsResult.data ?? []) as BusinessPulseMonthlyJobRow[],
    memberships: (membershipsResult.data ?? []) as BusinessPulseMembershipRow[],
    agreements: (agreementsResult.data ?? []) as BusinessPulseAgreementRow[],
    propertyLinks: (propertyLinksResult.data ?? []) as BusinessPulsePropertyLinkRow[],
    billingCharges: (billingChargesResult.data ?? []) as BusinessPulseBillingChargeRow[],
    addons: (addonsResult.data ?? []) as BusinessPulseAddonRow[],
    leads: (leadsResult.data ?? []) as BusinessPulseLeadRow[],
    jobberConnectionStatus: connection?.status ?? null,
    jobberLastSyncedAt: latestIso([
      latestJobber?.source_observed_at,
      latestJobber?.updated_at,
      connection?.last_verified_at,
      connection?.last_refreshed_at,
    ]),
    stripeConfigured: Boolean(
      process.env.STRIPE_SECRET_KEY?.trim() &&
        process.env.STRIPE_WEBHOOK_SECRET?.trim(),
    ),
    stripeLastEventAt: stripeEvents[0]?.received_at ?? null,
    stripeProcessingErrors: stripeEvents.filter((event) => event.processing_error)
      .length,
    goHighLevelConfigured: Boolean(
      process.env.GOHIGHLEVEL_PRIVATE_INTEGRATION_TOKEN?.trim() &&
        process.env.GOHIGHLEVEL_LOCATION_ID?.trim(),
    ),
    warnings,
  });
}
