import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getBusinessCalendarDayUtcBounds } from "@/lib/admin/company-business-timezone";
import { readJobberConnectionStatus } from "@/lib/care-operations/jobber-connection-store";
import { JOBBER_CONNECTION_ID } from "@/lib/care-operations/jobber-oauth-config";
import {
  selectNearestUpcomingJobberVisit,
  type JobberPortalVisitCandidate,
} from "@/lib/care-operations/jobber-portal-appointments";
import { isJobberTodayDataStale } from "@/lib/care-operations/jobber-today-types";
import { chunkItems } from "@/lib/care-operations/jobber-sync-utils";
import { createPrivilegedServerSupabaseClient } from "@/lib/persistence/supabase/client";
import {
  resolveSalesPaymentSetupEmailState,
  type SalesHandoffAgreementEvidence,
  type SalesHandoffHomeownerEvidence,
  type SalesHandoffPresentationEvidence,
  type SalesHandoffPropertyEvidence,
} from "./payment-handoff-readiness";
import {
  buildSalesProductionHandoffSnapshot,
  deriveSalesProductionHandoff,
  type SalesProductionHandoffMembership,
  type SalesProductionHandoffSnapshot,
} from "./production-handoff";

const HANDOFF_QUERY_CHUNK_SIZE = 100;
const HANDOFF_PAGE_SIZE = 500;

export interface SalesProductionHandoffAttributionSource {
  id: string;
  membershipId: string | null;
  signedAgreementId: string;
  qualificationStatus: "pending" | "active" | "qualified" | "cancelled";
  attributedArrCents: number;
  attributedAt: string;
}

type MembershipRow = SalesProductionHandoffMembership;

type HomeownerRow = SalesHandoffHomeownerEvidence;
type PresentationRow = SalesHandoffPresentationEvidence;
type AgreementRow = SalesHandoffAgreementEvidence;

interface PropertyRow extends SalesHandoffPropertyEvidence {
  id: string;
  name: string | null;
  address: string;
  city: string | null;
}

interface PropertyLinkRow {
  id: string;
  membership_id: string;
  property_id: string;
  external_property_id: string;
}

interface JobLinkRow {
  id: string;
  membership_id: string;
  property_id: string;
  external_job_id: string;
  external_property_id: string;
}

interface PageResult<T> {
  data: T[] | null;
  count: number | null;
  error: { message: string } | null;
}

async function loadCompletePages<T>(input: {
  label: string;
  page: (from: number, to: number) => PromiseLike<PageResult<T>>;
}): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;

  while (true) {
    const result = await input.page(
      offset,
      offset + HANDOFF_PAGE_SIZE - 1,
    );
    if (result.error) throw new Error(result.error.message);
    if (result.count === null) {
      throw new Error(`HomeAtlas could not prove complete ${input.label}.`);
    }
    const page = result.data ?? [];
    rows.push(...page);
    offset += page.length;
    if (offset >= result.count) return rows;
    if (page.length === 0) {
      throw new Error(`HomeAtlas could not finish loading ${input.label}.`);
    }
  }
}

async function loadMemberships(
  supabase: SupabaseClient,
  membershipIds: string[],
): Promise<MembershipRow[]> {
  const rows: MembershipRow[] = [];
  for (const ids of chunkItems(membershipIds, HANDOFF_QUERY_CHUNK_SIZE)) {
    rows.push(
      ...(await loadCompletePages<MembershipRow>({
        label: "sales handoff memberships",
        page: (from, to) =>
          supabase
            .from("memberships")
            .select(
              "id, homeowner_id, property_id, presentation_id, status, payment_setup_completed_at, stripe_payment_method_id, stripe_customer_id, agreement_id, sales_tier, visit_price, visits_per_year",
              { count: "exact" },
            )
            .in("id", ids)
            .order("id", { ascending: true })
            .range(from, to) as unknown as PromiseLike<
            PageResult<MembershipRow>
          >,
      })),
    );
  }
  return rows;
}

async function loadHomeowners(
  supabase: SupabaseClient,
  homeownerIds: string[],
): Promise<HomeownerRow[]> {
  const rows: HomeownerRow[] = [];
  for (const ids of chunkItems(homeownerIds, HANDOFF_QUERY_CHUNK_SIZE)) {
    rows.push(
      ...(await loadCompletePages<HomeownerRow>({
        label: "sales handoff homeowner identities",
        page: (from, to) =>
          supabase
            .from("homeowners")
            .select("id, full_name, email", { count: "exact" })
            .in("id", ids)
            .order("id", { ascending: true })
            .range(from, to) as unknown as PromiseLike<PageResult<HomeownerRow>>,
      })),
    );
  }
  return rows;
}

async function loadPresentations(
  supabase: SupabaseClient,
  presentationIds: string[],
): Promise<PresentationRow[]> {
  const rows: PresentationRow[] = [];
  for (const ids of chunkItems(presentationIds, HANDOFF_QUERY_CHUNK_SIZE)) {
    rows.push(
      ...(await loadCompletePages<PresentationRow>({
        label: "sales handoff presentations",
        page: (from, to) =>
          supabase
            .from("presentations")
            .select(
              "id, homeowner_id, property_id, membership_id, client_email, status",
              { count: "exact" },
            )
            .in("id", ids)
            .order("id", { ascending: true })
            .range(from, to) as unknown as PromiseLike<
            PageResult<PresentationRow>
          >,
      })),
    );
  }
  return rows;
}

async function loadSignedAgreements(
  supabase: SupabaseClient,
  agreementIds: string[],
): Promise<AgreementRow[]> {
  const rows: AgreementRow[] = [];
  for (const ids of chunkItems(agreementIds, HANDOFF_QUERY_CHUNK_SIZE)) {
    rows.push(
      ...(await loadCompletePages<AgreementRow>({
        label: "sales handoff signed agreements",
        page: (from, to) =>
          supabase
            .from("signed_agreements")
            .select(
              "id, membership_id, homeowner_id, property_id, status, billing_authorization_version, billing_authorized_at, billing_terms_hash",
              { count: "exact" },
            )
            .in("id", ids)
            .order("id", { ascending: true })
            .range(from, to) as unknown as PromiseLike<PageResult<AgreementRow>>,
      })),
    );
  }
  return rows;
}

async function loadProperties(
  supabase: SupabaseClient,
  propertyIds: string[],
): Promise<PropertyRow[]> {
  const rows: PropertyRow[] = [];
  for (const ids of chunkItems(propertyIds, HANDOFF_QUERY_CHUNK_SIZE)) {
    rows.push(
      ...(await loadCompletePages<PropertyRow>({
        label: "sales handoff property identities",
        page: (from, to) =>
          supabase
            .from("properties")
            .select("id, name, address, city", { count: "exact" })
            .in("id", ids)
            .order("id", { ascending: true })
            .range(from, to) as unknown as PromiseLike<PageResult<PropertyRow>>,
      })),
    );
  }
  return rows;
}

async function loadPropertyLinks(
  supabase: SupabaseClient,
  membershipIds: string[],
): Promise<PropertyLinkRow[]> {
  const rows: PropertyLinkRow[] = [];
  for (const ids of chunkItems(membershipIds, HANDOFF_QUERY_CHUNK_SIZE)) {
    rows.push(
      ...(await loadCompletePages<PropertyLinkRow>({
        label: "active Jobber property links",
        page: (from, to) =>
          supabase
            .from("jobber_property_links")
            .select(
              "id, membership_id, property_id, external_property_id",
              { count: "exact" },
            )
            .eq("connection_id", JOBBER_CONNECTION_ID)
            .eq("link_state", "active")
            .in("membership_id", ids)
            .order("id", { ascending: true })
            .range(from, to) as unknown as PromiseLike<
            PageResult<PropertyLinkRow>
          >,
      })),
    );
  }
  return rows;
}

async function loadJobLinks(
  supabase: SupabaseClient,
  membershipIds: string[],
): Promise<JobLinkRow[]> {
  const rows: JobLinkRow[] = [];
  for (const ids of chunkItems(membershipIds, HANDOFF_QUERY_CHUNK_SIZE)) {
    rows.push(
      ...(await loadCompletePages<JobLinkRow>({
        label: "active recurring Jobber job links",
        page: (from, to) =>
          supabase
            .from("jobber_membership_job_links")
            .select(
              "id, membership_id, property_id, external_job_id, external_property_id",
              { count: "exact" },
            )
            .eq("connection_id", JOBBER_CONNECTION_ID)
            .eq("link_state", "active")
            .in("membership_id", ids)
            .order("id", { ascending: true })
            .range(from, to) as unknown as PromiseLike<PageResult<JobLinkRow>>,
      })),
    );
  }
  return rows;
}

async function readScheduleSourceState(
  supabase: SupabaseClient,
  referenceDate: Date,
): Promise<{ fresh: boolean; observedAt: string | null }> {
  const [connection, latestResult] = await Promise.all([
    readJobberConnectionStatus(),
    supabase
      .from("jobber_visit_projections")
      .select("source_observed_at")
      .eq("connection_id", JOBBER_CONNECTION_ID)
      .order("source_observed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (latestResult.error) throw new Error(latestResult.error.message);
  const observedAt =
    typeof latestResult.data?.source_observed_at === "string"
      ? latestResult.data.source_observed_at
      : null;
  return {
    fresh:
      connection.connected &&
      !isJobberTodayDataStale(observedAt, referenceDate),
    observedAt,
  };
}

async function loadUpcomingVisits(
  supabase: SupabaseClient,
  jobLinks: JobLinkRow[],
  referenceDate: Date,
): Promise<JobberPortalVisitCandidate[]> {
  const externalJobIds = [
    ...new Set(jobLinks.map((link) => link.external_job_id)),
  ];
  if (externalJobIds.length === 0) return [];
  const rows: JobberPortalVisitCandidate[] = [];
  const businessDayStart =
    getBusinessCalendarDayUtcBounds(referenceDate).startUtc.toISOString();

  for (const ids of chunkItems(externalJobIds, HANDOFF_QUERY_CHUNK_SIZE)) {
    rows.push(
      ...(await loadCompletePages<JobberPortalVisitCandidate>({
        label: "upcoming recurring Jobber visits",
        page: (from, to) =>
          supabase
            .from("jobber_visit_projections")
            .select(
              "id, external_visit_id, external_job_id, external_client_id, external_property_id, title, visit_status, is_complete, scheduled_start, scheduled_end, completed_at, source_observed_at, source_payload_hash",
              { count: "exact" },
            )
            .eq("connection_id", JOBBER_CONNECTION_ID)
            .in("external_job_id", ids)
            .not("scheduled_start", "is", null)
            .gte("scheduled_start", businessDayStart)
            .order("scheduled_start", { ascending: true })
            .order("external_visit_id", { ascending: true })
            .range(from, to) as unknown as PromiseLike<
            PageResult<JobberPortalVisitCandidate>
          >,
      })),
    );
  }
  return rows;
}

function propertyLabel(row: PropertyRow | undefined): string {
  if (!row) return "Service property on file";
  return [row.address?.trim(), row.city?.trim()]
    .filter(Boolean)
    .join(", ") || row.name?.trim() || "Service property on file";
}

export async function loadSalesProductionHandoffSnapshotForAttributions(
  attributions: SalesProductionHandoffAttributionSource[],
  referenceDate = new Date(),
): Promise<SalesProductionHandoffSnapshot> {
  const activeAttributions = attributions.filter(
    (attribution) => attribution.qualificationStatus !== "cancelled",
  );
  if (activeAttributions.length === 0) {
    return buildSalesProductionHandoffSnapshot({
      records: [],
      generatedAt: referenceDate.toISOString(),
    });
  }

  const membershipIds = [
    ...new Set(
      activeAttributions
        .map((attribution) => attribution.membershipId)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  if (membershipIds.length === 0) {
    return buildSalesProductionHandoffSnapshot({
      generatedAt: referenceDate.toISOString(),
      records: activeAttributions.map((attribution) =>
        deriveSalesProductionHandoff({
          attributionId: attribution.id,
          membershipId: null,
          homeownerName: "Signed homeowner",
          propertyAddress: "Service property on file",
          attributedArrCents: attribution.attributedArrCents,
          attributedAt: attribution.attributedAt,
          membership: null,
          paymentSetupEmailState: "not_available",
          propertyLinked: false,
          recurringJobCount: 0,
          scheduleSourceState: "unavailable",
          scheduleObservedAt: null,
          nextScheduledAt: null,
        }),
      ),
    });
  }
  const supabase = createPrivilegedServerSupabaseClient();
  const memberships = await loadMemberships(supabase, membershipIds);
  const homeownerIds = [
    ...new Set(memberships.map((membership) => membership.homeowner_id)),
  ];
  const propertyIds = [
    ...new Set(memberships.map((membership) => membership.property_id)),
  ];
  const presentationIds = [
    ...new Set(
      memberships
        .map((membership) => membership.presentation_id)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const signedAgreementIds = [
    ...new Set(activeAttributions.map((attribution) => attribution.signedAgreementId)),
  ];

  const [
    homeowners,
    properties,
    presentations,
    agreements,
    propertyLinks,
    jobLinks,
    scheduleSource,
  ] =
    await Promise.all([
      loadHomeowners(supabase, homeownerIds),
      loadProperties(supabase, propertyIds),
      loadPresentations(supabase, presentationIds),
      loadSignedAgreements(supabase, signedAgreementIds),
      loadPropertyLinks(supabase, membershipIds),
      loadJobLinks(supabase, membershipIds),
      readScheduleSourceState(supabase, referenceDate),
    ]);
  const visits = scheduleSource.fresh
    ? await loadUpcomingVisits(supabase, jobLinks, referenceDate)
    : [];

  const membershipById = new Map(
    memberships.map((membership) => [membership.id, membership]),
  );
  const homeownerById = new Map(
    homeowners.map((homeowner) => [homeowner.id, homeowner]),
  );
  const propertyById = new Map(
    properties.map((property) => [property.id, property]),
  );
  const presentationById = new Map(
    presentations.map((presentation) => [presentation.id, presentation]),
  );
  const agreementById = new Map(
    agreements.map((agreement) => [agreement.id, agreement]),
  );
  const propertyLinkByMembership = new Map<string, PropertyLinkRow>();
  for (const link of propertyLinks) {
    const membership = membershipById.get(link.membership_id);
    if (membership?.property_id === link.property_id) {
      propertyLinkByMembership.set(link.membership_id, link);
    }
  }
  const jobLinksByMembership = new Map<string, JobLinkRow[]>();
  for (const link of jobLinks) {
    const membership = membershipById.get(link.membership_id);
    const propertyLink = propertyLinkByMembership.get(link.membership_id);
    if (
      membership?.property_id !== link.property_id ||
      propertyLink?.external_property_id !== link.external_property_id
    ) {
      continue;
    }
    const current = jobLinksByMembership.get(link.membership_id) ?? [];
    current.push(link);
    jobLinksByMembership.set(link.membership_id, current);
  }

  const records = activeAttributions.map((attribution) => {
    const membership = attribution.membershipId
      ? membershipById.get(attribution.membershipId) ?? null
      : null;
    const membershipJobLinks = membership
      ? jobLinksByMembership.get(membership.id) ?? []
      : [];
    const homeowner = membership
      ? homeownerById.get(membership.homeowner_id)
      : undefined;
    const property = membership
      ? propertyById.get(membership.property_id)
      : undefined;
    const presentation = membership?.presentation_id
      ? presentationById.get(membership.presentation_id)
      : undefined;
    const agreement = agreementById.get(attribution.signedAgreementId);
    const linkedJobKeys = new Set(
      membershipJobLinks.map(
        (link) => `${link.external_job_id}\u0000${link.external_property_id}`,
      ),
    );
    const nearest = selectNearestUpcomingJobberVisit(
      visits.filter((visit) =>
        linkedJobKeys.has(
          `${visit.external_job_id}\u0000${visit.external_property_id}`,
        ),
      ),
      referenceDate,
    );

    return deriveSalesProductionHandoff({
      attributionId: attribution.id,
      membershipId: attribution.membershipId,
      homeownerName: membership
        ? homeownerById.get(membership.homeowner_id)?.full_name ??
          "Signed homeowner"
        : "Signed homeowner",
      propertyAddress: membership
        ? propertyLabel(propertyById.get(membership.property_id))
        : "Service property on file",
      attributedArrCents: attribution.attributedArrCents,
      attributedAt: attribution.attributedAt,
      membership,
      paymentSetupEmailState: resolveSalesPaymentSetupEmailState({
        signedAgreementId: attribution.signedAgreementId,
        membership,
        homeowner,
        property,
        presentation,
        agreement,
      }),
      propertyLinked: membership
        ? propertyLinkByMembership.has(membership.id)
        : false,
      recurringJobCount: membershipJobLinks.length,
      scheduleSourceState: scheduleSource.fresh ? "fresh" : "unavailable",
      scheduleObservedAt: scheduleSource.observedAt,
      nextScheduledAt: nearest?.scheduled_start ?? null,
    });
  });

  return buildSalesProductionHandoffSnapshot({
    records,
    generatedAt: referenceDate.toISOString(),
  });
}
