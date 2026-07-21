import { resolveAgreementPdfAccessUrl } from "@/lib/agreement/signed-agreement-storage";
import {
  createPrivilegedServerSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";
import type { AtlasThemeId } from "@/lib/theme/atlas-themes";
import type {
  PersistedMemberAppointment,
  PersistedMemberProfile,
  PersistedMemberSavingsTransaction,
} from "@/lib/persistence/types/member-profile";
import type { MembershipTier } from "@/lib/persistence/types/member-profile";
import type { PropertyDetailsRecord } from "@/lib/persistence/types/property-intelligence";
import type {
  MemberAppointmentSummary,
  MemberProfile,
  MemberSavingsEntry,
  PropertyRecord,
} from "@/lib/member-intelligence/types";
import { resolvePortalPaymentMethodLabel } from "@/lib/membership/resolve-portal-payment-method";
import { resolvePortalMembershipStatus } from "@/lib/membership/membership-status";
import { normalizeToSqueegeeKingTier, SQUEEGEEKING_TIERS } from "@/lib/membership/tier-config";
import { loadMembershipPortalRow } from "@/lib/persistence/queries/load-membership-portal-row";
import {
  mapMemberCareAddonRecord,
  type MemberCareAddonRecord,
} from "@/lib/membership/portal-care-addons";
import type { MemberAddonStatus } from "@/lib/persistence/types/member-addon";
import type { MemberSavingsLedgerView } from "@/lib/membership/member-savings-ledger";
import { loadMemberSavingsLedgerView } from "@/lib/membership/member-savings-ledger-server";
import { logProtectedQueryResult } from "@/lib/persistence/supabase/rls-query-log";
import {
  AUTHORITATIVE_APPOINTMENT_MATCH_STATE,
  AUTHORITATIVE_APPOINTMENT_PROVENANCE_STATES,
  AUTHORITATIVE_APPOINTMENT_PROVIDER,
  AUTHORITATIVE_APPOINTMENT_VERIFICATION_STATE,
  AUTHORITATIVE_COMPLETED_JOBBER_AUTHORITY_STATE,
  AUTHORITATIVE_JOBBER_AUTHORITY_STATE,
} from "@/lib/care-operations/model";
import type { PortalAccessContext } from "@/lib/persistence/queries/portal-access";

export interface ServiceObservationView {
  id: string;
  observedAt: string;
  observedBy: string | null;
  notes: string;
  category: string | null;
  severity: string | null;
}

export interface MemberPortalYTDSavings {
  savings: number;
  retail: number;
  paid: number;
}

export interface MemberPortalLifetimeSavings {
  savings: number;
  retail: number;
  paid: number;
  entries: MemberSavingsEntry[];
}

export interface MemberPortalAgreement {
  planName: string;
  signedAt: string;
  pdfUrl: string | null;
}

export interface MemberPortalData {
  profile: MemberProfile;
  property: PropertyRecord;
  propertyName: string;
  appointments: MemberAppointmentSummary[];
  nextAppointment: MemberAppointmentSummary | null;
  ytdSavings: MemberPortalYTDSavings;
  lifetimeSavings: MemberPortalLifetimeSavings;
  observations: ServiceObservationView[];
  membershipPlanName: string;
  monthlyRate: number;
  memberSince: string | null;
  foundingMember: boolean;
  foundingMemberSince: string | null;
  salesTier: string | null;
  visitPrice: number | null;
  visitsPerYear: number | null;
  membershipStatus: string;
  paymentSetupCompletedAt: string | null;
  membershipEnrollmentSavings: number | null;
  agreement: MemberPortalAgreement | null;
  presentationId: string | null;
  membershipId: string | null;
  portalTheme: AtlasThemeId | null;
  paymentMethodLabel: string | null;
  careAddons: MemberCareAddonRecord[];
  savingsLedger: MemberSavingsLedgerView | null;
}

interface HomeownerRow {
  id: string;
  slug: string;
  full_name: string;
  first_name: string;
  email: string | null;
  phone: string | null;
}

interface PropertyRow {
  id: string;
  homeowner_id: string;
  slug: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  square_feet: number | null;
  zillow_url: string | null;
  property_details: PropertyDetailsRecord | null;
  access_instructions: string | null;
  service_notes: string[] | null;
  preferred_products: string[] | null;
}

interface MembershipRow {
  id: string;
  homeowner_id: string;
  property_id: string;
  plan_name: string;
  price_display: string;
  started_at: string | null;
  status: string;
  founding_member: boolean;
  founding_member_since: string | null;
  sales_tier: string | null;
  visit_price: number | null;
  visits_per_year: number | null;
  payment_setup_completed_at: string | null;
  presentation_id: string | null;
  stripe_payment_method_id: string | null;
  agreement_id: string | null;
  membership_enrollment_savings: number | null;
}

function membershipTierFromSalesTier(
  salesTier: string | null | undefined,
): MembershipTier {
  return normalizeToSqueegeeKingTier(salesTier ?? "quarterly") === "biannual"
    ? "standard"
    : "premium";
}

interface SignedAgreementRow {
  homeowner_id: string;
  property_id: string;
  membership_id: string;
  plan_name: string;
  signed_at: string;
  agreement_pdf_url: string | null;
  status: string;
}

interface MemberProfileRow {
  id: string;
  homeowner_id: string;
  membership_tier: PersistedMemberProfile["membershipTier"];
  total_saved_cents: number;
  preferred_services: string[];
  created_at: string;
}

interface AppointmentRow {
  id: string;
  member_profile_id: string;
  property_id: string;
  service_type: string;
  scheduled_at: string;
  status: PersistedMemberAppointment["status"];
  technician_name: string | null;
  notes: string | null;
  completed_at: string | null;
  provider: string | null;
  external_id: string | null;
  source_payload_hash: string | null;
  source_observed_at: string | null;
  jobber_visit_classification_id: string | null;
  jobber_projection_id: string | null;
  jobber_connection_id: string | null;
  jobber_property_link_id: string | null;
  jobber_property_link_updated_at: string | null;
  jobber_membership_id: string | null;
  jobber_authority_state: string | null;
  completion_evidence:
    | JobberVisitCompletionEventRow
    | JobberVisitCompletionEventRow[]
    | null;
}

interface JobberVisitCompletionEventRow {
  appointment_id: string;
  classification_id: string;
  projection_id: string;
  connection_id: string;
  external_visit_id: string;
  source_payload_hash: string;
  source_observed_at: string;
  property_link_id: string;
  property_link_updated_at: string;
  membership_id: string;
  property_id: string;
  provider_visit_status: string;
  provider_is_complete: boolean;
  provider_completed_at: string;
}

interface SavingsRow {
  saved_cents: number;
  regular_price_cents: number;
  member_price_cents: number;
  service_type: string;
  occurred_at: string;
}

interface ObservationRow {
  id: string;
  observed_by: string | null;
  notes: string;
  observation_flags: Array<{ category?: string; severity?: string }> | null;
  observed_at: string;
}

function parsePriceDisplay(priceDisplay: string): number {
  const digits = priceDisplay.replace(/[^\d.]/g, "");
  const value = Number.parseFloat(digits);
  return Number.isFinite(value) ? value : 0;
}

function centsToDollars(cents: number): number {
  return Math.round(cents) / 100;
}

function mapAppointment(
  row: AppointmentRow,
  options?: { countsTowardMembershipSavings?: boolean },
): MemberAppointmentSummary {
  return {
    id: row.id,
    date: row.scheduled_at,
    serviceType: row.service_type,
    technician: row.technician_name,
    notes: row.notes,
    status: row.status,
    ...(options?.countsTowardMembershipSavings === false
      ? { countsTowardMembershipSavings: false }
      : {}),
  };
}

function getSingleCompletionEvidence(
  row: AppointmentRow,
): JobberVisitCompletionEventRow | null {
  const evidence = row.completion_evidence;
  if (Array.isArray(evidence)) {
    return evidence.length === 1 ? evidence[0] : null;
  }
  return evidence ?? null;
}

function isApprovedScheduledAppointment(row: AppointmentRow): boolean {
  return (
    row.jobber_authority_state === AUTHORITATIVE_JOBBER_AUTHORITY_STATE &&
    row.status === "scheduled" &&
    row.completed_at === null &&
    getSingleCompletionEvidence(row) === null
  );
}

function hasExactCompletionEvidence(
  row: AppointmentRow,
  membershipId: string,
  propertyId: string,
): boolean {
  const evidence = getSingleCompletionEvidence(row);
  if (!evidence) return false;

  return Boolean(
    row.jobber_authority_state ===
      AUTHORITATIVE_COMPLETED_JOBBER_AUTHORITY_STATE &&
      row.status === "completed" &&
      row.completed_at &&
      row.provider === AUTHORITATIVE_APPOINTMENT_PROVIDER &&
      row.external_id &&
      row.source_payload_hash &&
      row.source_observed_at &&
      row.jobber_visit_classification_id &&
      row.jobber_projection_id &&
      row.jobber_connection_id &&
      row.jobber_property_link_id &&
      row.jobber_property_link_updated_at &&
      row.jobber_membership_id === membershipId &&
      row.property_id === propertyId &&
      evidence.appointment_id === row.id &&
      evidence.membership_id === row.jobber_membership_id &&
      evidence.property_id === row.property_id &&
      evidence.external_visit_id === row.external_id &&
      evidence.source_payload_hash === row.source_payload_hash &&
      evidence.source_observed_at === row.source_observed_at &&
      evidence.classification_id === row.jobber_visit_classification_id &&
      evidence.projection_id === row.jobber_projection_id &&
      evidence.connection_id === row.jobber_connection_id &&
      evidence.property_link_id === row.jobber_property_link_id &&
      evidence.property_link_updated_at ===
        row.jobber_property_link_updated_at &&
      evidence.provider_visit_status === "COMPLETED" &&
      evidence.provider_is_complete === true &&
      evidence.provider_completed_at === row.completed_at
  );
}

function mapSavingsRow(row: SavingsRow): MemberSavingsEntry {
  return {
    date: row.occurred_at,
    serviceType: row.service_type,
    regularPrice: centsToDollars(row.regular_price_cents),
    memberPrice: centsToDollars(row.member_price_cents),
    saved: centsToDollars(row.saved_cents),
  };
}

function mapObservation(row: ObservationRow): ServiceObservationView {
  const flag = row.observation_flags?.[0];
  return {
    id: row.id,
    observedAt: row.observed_at,
    observedBy: row.observed_by,
    notes: row.notes,
    category: flag?.category ?? null,
    severity: flag?.severity ?? null,
  };
}

function buildMemberProfileFromHomeowner(
  homeowner: HomeownerRow,
  membership: MembershipRow | null,
  savingsHistory: MemberSavingsEntry[],
  appointments: MemberAppointmentSummary[],
  nextAppointment: MemberAppointmentSummary | null,
  propertyId: string,
): MemberProfile {
  const nameParts = homeowner.full_name.trim().split(/\s+/);
  const firstName = homeowner.first_name || nameParts[0] || "Member";
  const lastName =
    nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

  return {
    id: `homeowner-${homeowner.id}`,
    firstName,
    lastName,
    email: homeowner.email,
    phone: homeowner.phone,
    memberSince: membership?.started_at ?? null,
    membershipTier: membershipTierFromSalesTier(membership?.sales_tier),
    membershipStatus: resolvePortalMembershipStatus({
      status: membership?.status ?? "inactive",
      payment_setup_completed_at: membership?.payment_setup_completed_at ?? null,
      stripe_payment_method_id: membership?.stripe_payment_method_id ?? null,
      agreement_id: membership?.agreement_id ?? undefined,
      sales_tier: membership?.sales_tier ?? undefined,
      visit_price: membership?.visit_price ?? undefined,
    }),
    totalSaved: savingsHistory.reduce((sum, row) => sum + row.saved, 0),
    savingsHistory,
    nextAppointment,
    appointmentHistory: appointments,
    propertyId,
  };
}

function buildMemberProfile(
  homeowner: HomeownerRow,
  profileRow: MemberProfileRow,
  membership: MembershipRow | null,
  savingsHistory: MemberSavingsEntry[],
  appointments: MemberAppointmentSummary[],
  nextAppointment: MemberAppointmentSummary | null,
  propertyId: string,
): MemberProfile {
  const nameParts = homeowner.full_name.trim().split(/\s+/);
  const firstName = homeowner.first_name || nameParts[0] || "Member";
  const lastName =
    nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

  return {
    id: profileRow.id,
    firstName,
    lastName,
    email: homeowner.email,
    phone: homeowner.phone,
    memberSince: membership?.started_at ?? profileRow.created_at,
    membershipTier: profileRow.membership_tier,
    membershipStatus: resolvePortalMembershipStatus({
      status: membership?.status ?? "inactive",
      payment_setup_completed_at: membership?.payment_setup_completed_at ?? null,
      stripe_payment_method_id: membership?.stripe_payment_method_id ?? null,
      agreement_id: membership?.agreement_id ?? undefined,
      sales_tier: membership?.sales_tier ?? undefined,
      visit_price: membership?.visit_price ?? undefined,
    }),
    totalSaved: savingsHistory.reduce((sum, row) => sum + row.saved, 0),
    savingsHistory,
    nextAppointment,
    appointmentHistory: appointments,
    propertyId,
  };
}

function buildPropertyRecord(row: PropertyRow, memberProfileId: string): PropertyRecord {
  return {
    id: row.id,
    memberId: memberProfileId,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip,
    zillowUrl: row.zillow_url,
    photos: [],
    details: row.property_details ?? {},
    serviceNotes: [],
    preferredProducts: [],
    accessInstructions: null,
  };
}

export async function getMemberPortalDataByAccess(
  access: PortalAccessContext,
): Promise<MemberPortalData | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = createPrivilegedServerSupabaseClient();

  const { data: homeowner, error: homeownerError } = await supabase
    .from("homeowners")
    .select("id, slug, full_name, first_name, email, phone")
    .eq("id", access.homeownerId)
    .eq("slug", access.homeownerSlug)
    .maybeSingle();

  if (
    homeownerError ||
    !homeowner ||
    homeowner.id !== access.homeownerId ||
    homeowner.slug !== access.homeownerSlug
  ) {
    return null;
  }

  const homeownerRow = homeowner as HomeownerRow;

  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select(
      "id, homeowner_id, slug, name, address, city, state, zip, square_feet, zillow_url, property_details",
    )
    .eq("id", access.propertyId)
    .eq("homeowner_id", access.homeownerId)
    .eq("slug", access.propertySlug)
    .maybeSingle();

  if (
    propertyError ||
    !property ||
    property.id !== access.propertyId ||
    property.homeowner_id !== access.homeownerId ||
    property.slug !== access.propertySlug
  ) {
    return null;
  }

  const propertyRow = property as PropertyRow;

  const membershipRow = await loadMembershipPortalRow(
    supabase,
    access.membershipId,
    access.homeownerId,
    access.propertyId,
  );
  if (
    !membershipRow ||
    membershipRow.id !== access.membershipId ||
    membershipRow.homeowner_id !== access.homeownerId ||
    membershipRow.property_id !== access.propertyId
  ) {
    return null;
  }

  const { data: profileRow, error: profileError } = await supabase
    .from("member_profiles")
    .select("id, homeowner_id, membership_tier, total_saved_cents, preferred_services, created_at")
    .eq("homeowner_id", homeownerRow.id)
    .maybeSingle();

  if (profileError) {
    logProtectedQueryResult(
      {
        surface: "member-portal.member_profiles",
        table: "member_profiles",
        propertyId: propertyRow.id,
        membershipId: membershipRow?.id ?? null,
      },
      { count: 0, error: profileError },
    );
    return null;
  }

  const profile = profileRow as MemberProfileRow | null;
  if (profile && profile.homeowner_id !== access.homeownerId) {
    return null;
  }
  logProtectedQueryResult(
    {
      surface: "member-portal.member_profiles",
      table: "member_profiles",
      propertyId: propertyRow.id,
      membershipId: membershipRow?.id ?? null,
    },
    { count: profile ? 1 : 0 },
  );

  const paymentMethodLabel = membershipRow?.payment_setup_completed_at
    ? await resolvePortalPaymentMethodLabel(
        membershipRow.stripe_payment_method_id,
      )
    : null;

  const { data: agreementRow, error: agreementError } = await supabase
    .from("signed_agreements")
    .select(
      "homeowner_id, property_id, membership_id, plan_name, signed_at, agreement_pdf_url, status",
    )
    .eq("homeowner_id", access.homeownerId)
    .eq("property_id", access.propertyId)
    .eq("membership_id", access.membershipId)
    .eq("status", "complete")
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const agreement = agreementRow as SignedAgreementRow | null;
  if (
    agreementError ||
    (agreement &&
      (agreement.homeowner_id !== access.homeownerId ||
        agreement.property_id !== access.propertyId ||
        agreement.membership_id !== access.membershipId))
  ) {
    return null;
  }

  // Keep the established approved-schedule query independent from migration
  // 043. If the completion table or PostgREST relationship is unavailable,
  // valid scheduled visits must remain visible.
  const { data: scheduledAppointmentRows, error: scheduledAppointmentError } =
    await supabase
    .from("member_appointments")
    .select(
      `id, member_profile_id, property_id, service_type, scheduled_at, status,
       technician_name, notes, completed_at, provider, external_id,
       source_payload_hash, source_observed_at, jobber_visit_classification_id,
       jobber_projection_id, jobber_connection_id, jobber_property_link_id,
       jobber_property_link_updated_at, jobber_membership_id,
       jobber_authority_state`,
    )
    .eq("property_id", access.propertyId)
    .eq("provider", AUTHORITATIVE_APPOINTMENT_PROVIDER)
    .in("provenance_state", [...AUTHORITATIVE_APPOINTMENT_PROVENANCE_STATES])
    .eq("verification_state", AUTHORITATIVE_APPOINTMENT_VERIFICATION_STATE)
    .eq("match_state", AUTHORITATIVE_APPOINTMENT_MATCH_STATE)
    .eq("jobber_authority_state", AUTHORITATIVE_JOBBER_AUTHORITY_STATE)
    .not("jobber_visit_classification_id", "is", null)
    .eq("jobber_membership_id", access.membershipId)
    .order("scheduled_at", { ascending: true });

  const { data: completedAppointmentRows, error: completedAppointmentError } =
    await supabase
      .from("member_appointments")
      .select(
        `id, member_profile_id, property_id, service_type, scheduled_at, status,
       technician_name, notes, completed_at, provider, external_id,
       source_payload_hash, source_observed_at, jobber_visit_classification_id,
       jobber_projection_id, jobber_connection_id, jobber_property_link_id,
       jobber_property_link_updated_at, jobber_membership_id,
       jobber_authority_state,
       completion_evidence:jobber_visit_completion_events(
         appointment_id, classification_id, projection_id, connection_id,
         external_visit_id, source_payload_hash, source_observed_at,
         property_link_id, property_link_updated_at, membership_id, property_id,
         provider_visit_status, provider_is_complete, provider_completed_at
       )`,
      )
      .eq("property_id", access.propertyId)
      .eq("provider", AUTHORITATIVE_APPOINTMENT_PROVIDER)
      .in("provenance_state", [...AUTHORITATIVE_APPOINTMENT_PROVENANCE_STATES])
      .eq("verification_state", AUTHORITATIVE_APPOINTMENT_VERIFICATION_STATE)
      .eq("match_state", AUTHORITATIVE_APPOINTMENT_MATCH_STATE)
      .eq(
        "jobber_authority_state",
        AUTHORITATIVE_COMPLETED_JOBBER_AUTHORITY_STATE,
      )
      .not("jobber_visit_classification_id", "is", null)
      .eq("jobber_membership_id", access.membershipId)
      .order("scheduled_at", { ascending: true });

  if (scheduledAppointmentError || completedAppointmentError) {
    logProtectedQueryResult(
      {
        surface: "member-portal.appointments",
        table: "member_appointments",
        propertyId: propertyRow.id,
        membershipId: membershipRow?.id ?? null,
      },
      {
        count: scheduledAppointmentRows?.length ?? 0,
        error: scheduledAppointmentError ?? completedAppointmentError,
      },
    );
  } else {
    logProtectedQueryResult(
      {
        surface: "member-portal.appointments",
        table: "member_appointments",
        propertyId: propertyRow.id,
        membershipId: membershipRow?.id ?? null,
      },
      {
        count:
          (scheduledAppointmentRows?.length ?? 0) +
          (completedAppointmentRows?.length ?? 0),
      },
    );
  }

  const approvedScheduledRows = (
    (scheduledAppointmentRows ?? []) as AppointmentRow[]
  ).filter(isApprovedScheduledAppointment);
  const evidencedCompletedRows = (
    (completedAppointmentRows ?? []) as AppointmentRow[]
  ).filter((row) =>
    hasExactCompletionEvidence(row, access.membershipId, access.propertyId),
  );
  const evidencedCompletedIds = new Set(
    evidencedCompletedRows.map((row) => row.id),
  );
  // The two reads are intentionally independent for pre-043 continuity. If a
  // visit completes between them, exact immutable evidence wins over the
  // earlier scheduled snapshot. Malformed or missing evidence never displaces
  // a valid scheduled visit.
  const currentApprovedScheduledRows = approvedScheduledRows.filter(
    (row) => !evidencedCompletedIds.has(row.id),
  );
  const appointments = [
    ...currentApprovedScheduledRows.map((row) => mapAppointment(row)),
    ...evidencedCompletedRows.map((row) =>
      mapAppointment(row, { countsTowardMembershipSavings: false }),
    ),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const approvedScheduledAppointments = currentApprovedScheduledRows.map(
    (row) => mapAppointment(row),
  );

  const today = new Date().toISOString();
  const nextAppointment =
    appointments.find(
      (a) => a.status === "scheduled" && a.date >= today,
    ) ??
    appointments.find((a) => a.status === "scheduled") ??
    null;

  const yearStart = `${new Date().getFullYear()}-01-01T00:00:00Z`;

  const { data: allSavingsRows } = profile
    ? await supabase
        .from("member_savings_transactions")
        .select(
          "saved_cents, regular_price_cents, member_price_cents, service_type, occurred_at",
        )
        .eq("member_profile_id", profile.id)
        .eq("property_id", access.propertyId)
        .order("occurred_at", { ascending: false })
    : { data: [] };

  const allSavingsEntries = ((allSavingsRows ?? []) as SavingsRow[]).map(
    mapSavingsRow,
  );

  const lifetimeSavings = allSavingsEntries.reduce<MemberPortalLifetimeSavings>(
    (acc, row) => ({
      savings: acc.savings + row.saved,
      retail: acc.retail + row.regularPrice,
      paid: acc.paid + row.memberPrice,
      entries: acc.entries,
    }),
    { savings: 0, retail: 0, paid: 0, entries: allSavingsEntries },
  );

  const ytdEntries = allSavingsEntries.filter((row) => row.date >= yearStart);
  const ytdSavings = ytdEntries.reduce<MemberPortalYTDSavings>(
    (acc, row) => ({
      savings: acc.savings + row.saved,
      retail: acc.retail + row.regularPrice,
      paid: acc.paid + row.memberPrice,
    }),
    { savings: 0, retail: 0, paid: 0 },
  );

  const { data: observationRows } = await supabase
    .from("service_observations")
    .select("id, observed_by, notes, observation_flags, observed_at")
    .eq("property_id", access.propertyId)
    .order("observed_at", { ascending: false })
    .limit(5);

  const observations = ((observationRows ?? []) as ObservationRow[]).map(
    mapObservation,
  );

  const memberProfile = profile
    ? buildMemberProfile(
        homeownerRow,
        profile,
        membershipRow,
        allSavingsEntries,
        appointments,
        nextAppointment,
        propertyRow.id,
      )
    : buildMemberProfileFromHomeowner(
        homeownerRow,
        membershipRow,
        allSavingsEntries,
        appointments,
        nextAppointment,
        propertyRow.id,
      );

  const agreementPdfUrl = agreement
    ? await resolveAgreementPdfAccessUrl(
        agreement.agreement_pdf_url,
      )
    : null;

  let careAddons: MemberCareAddonRecord[] = [];
  if (membershipRow?.id) {
    const { data: addonRows, error: addonError } = await supabase
      .from("member_addon_transactions")
      .select(
        "id, service_name, service_date, amount_charged_cents, saved_cents, status",
      )
      .eq("membership_id", access.membershipId)
      .eq("property_id", access.propertyId)
      .order("service_date", { ascending: false });

    if (addonError) {
      logProtectedQueryResult(
        {
          surface: "member-portal.addons",
          table: "member_addon_transactions",
          propertyId: propertyRow.id,
          membershipId: membershipRow.id,
        },
        { count: 0, error: addonError },
      );
    } else {
      logProtectedQueryResult(
        {
          surface: "member-portal.addons",
          table: "member_addon_transactions",
          propertyId: propertyRow.id,
          membershipId: membershipRow.id,
        },
        { count: addonRows?.length ?? 0 },
      );
    }

    if (!addonError) {
      careAddons = ((addonRows ?? []) as Array<{
        id: string;
        service_name: string;
        service_date: string;
        amount_charged_cents: number;
        saved_cents: number;
        status: MemberAddonStatus;
      }>).map(mapMemberCareAddonRecord);
    }
  }

  const tierId = normalizeToSqueegeeKingTier(
    membershipRow?.sales_tier ?? "quarterly",
  );
  const savingsLedger: MemberSavingsLedgerView | null = membershipRow?.id
    ? await loadMemberSavingsLedgerView({
        membershipId: membershipRow.id,
        memberProfileId: profile?.id ?? null,
        tierId,
        addonDiscountPercent: SQUEEGEEKING_TIERS[tierId].addonDiscount,
        enrollmentSavingsPerVisit:
          membershipRow.membership_enrollment_savings != null
            ? Number(membershipRow.membership_enrollment_savings)
            : null,
        // Completion evidence grants history visibility only. It does not infer
        // a savings-ledger entry, obligation outcome, price, or billing state.
        appointments: approvedScheduledAppointments,
        careAddons,
      })
    : null;

  return {
    profile: memberProfile,
    property: buildPropertyRecord(propertyRow, memberProfile.id),
    propertyName: propertyRow.name,
    appointments,
    nextAppointment,
    ytdSavings,
    lifetimeSavings,
    observations,
    membershipPlanName: membershipRow?.plan_name ?? "Preferred Care",
    monthlyRate: membershipRow
      ? parsePriceDisplay(membershipRow.price_display)
      : 0,
    memberSince: membershipRow?.started_at ?? profile?.created_at ?? null,
    foundingMember: membershipRow?.founding_member ?? false,
    foundingMemberSince: membershipRow?.founding_member_since ?? null,
    salesTier: membershipRow?.sales_tier ?? null,
    visitPrice: membershipRow?.visit_price ?? null,
    visitsPerYear: membershipRow?.visits_per_year ?? null,
    membershipStatus: membershipRow
      ? resolvePortalMembershipStatus({
          status: membershipRow.status,
          payment_setup_completed_at: membershipRow.payment_setup_completed_at,
          stripe_payment_method_id: membershipRow.stripe_payment_method_id,
          agreement_id: membershipRow.agreement_id ?? undefined,
          sales_tier: membershipRow.sales_tier ?? undefined,
          visit_price: membershipRow.visit_price ?? undefined,
        })
      : "inactive",
    paymentSetupCompletedAt:
      membershipRow?.payment_setup_completed_at ?? null,
    membershipEnrollmentSavings:
      membershipRow?.membership_enrollment_savings != null
        ? Number(membershipRow.membership_enrollment_savings)
        : null,
    agreement: agreement
      ? {
          planName: agreement.plan_name,
          signedAt: agreement.signed_at,
          pdfUrl: agreementPdfUrl,
        }
      : null,
    presentationId: membershipRow?.presentation_id ?? null,
    membershipId: membershipRow?.id ?? null,
    portalTheme: membershipRow?.portal_theme ?? null,
    paymentMethodLabel,
    careAddons,
    savingsLedger,
  };
}

export type {
  PersistedMemberAppointment,
  PersistedMemberSavingsTransaction,
};
