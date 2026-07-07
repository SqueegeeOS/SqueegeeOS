import {
  createServerSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";
import type {
  PersistedMemberAppointment,
  PersistedMemberProfile,
  PersistedMemberSavingsTransaction,
} from "@/lib/persistence/types/member-profile";
import type { PropertyDetailsRecord } from "@/lib/persistence/types/property-intelligence";
import type {
  MemberAppointmentSummary,
  MemberProfile,
  MemberSavingsEntry,
  PropertyRecord,
} from "@/lib/member-intelligence/types";

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

export interface MemberPortalData {
  profile: MemberProfile;
  property: PropertyRecord;
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
  plan_name: string;
  price_display: string;
  started_at: string | null;
  status: string;
  founding_member: boolean;
  founding_member_since: string | null;
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

function mapAppointment(row: AppointmentRow): MemberAppointmentSummary {
  return {
    id: row.id,
    date: row.scheduled_at,
    serviceType: row.service_type,
    technician: row.technician_name,
    notes: row.notes,
    status: row.status,
  };
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
    membershipStatus:
      membership?.status === "active"
        ? "active"
        : membership?.status === "cancelled"
          ? "cancelled"
          : "inactive",
    totalSaved: centsToDollars(profileRow.total_saved_cents),
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
    serviceNotes: row.service_notes ?? [],
    preferredProducts: row.preferred_products ?? [],
    accessInstructions: row.access_instructions,
  };
}

export async function getMemberPortalDataBySlugs(
  homeownerSlug: string,
  propertySlug: string,
): Promise<MemberPortalData | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = createServerSupabaseClient();

  const { data: homeowner, error: homeownerError } = await supabase
    .from("homeowners")
    .select("id, slug, full_name, first_name, email, phone")
    .eq("slug", homeownerSlug)
    .maybeSingle();

  if (homeownerError || !homeowner) {
    return null;
  }

  const homeownerRow = homeowner as HomeownerRow;

  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select(
      "id, homeowner_id, slug, name, address, city, state, zip, square_feet, zillow_url, property_details, access_instructions, service_notes, preferred_products",
    )
    .eq("homeowner_id", homeownerRow.id)
    .eq("slug", propertySlug)
    .maybeSingle();

  if (propertyError || !property) {
    return null;
  }

  const propertyRow = property as PropertyRow;

  const { data: profileRow, error: profileError } = await supabase
    .from("member_profiles")
    .select("id, homeowner_id, membership_tier, total_saved_cents, preferred_services, created_at")
    .eq("homeowner_id", homeownerRow.id)
    .maybeSingle();

  if (profileError || !profileRow) {
    return null;
  }

  const profile = profileRow as MemberProfileRow;

  const { data: membership } = await supabase
    .from("memberships")
    .select(
      "plan_name, price_display, started_at, status, founding_member, founding_member_since",
    )
    .eq("property_id", propertyRow.id)
    .maybeSingle();

  const membershipRow = (membership as MembershipRow | null) ?? null;

  const { data: appointmentRows } = await supabase
    .from("member_appointments")
    .select(
      "id, member_profile_id, property_id, service_type, scheduled_at, status, technician_name, notes, completed_at",
    )
    .eq("member_profile_id", profile.id)
    .eq("property_id", propertyRow.id)
    .order("scheduled_at", { ascending: true });

  const appointments = ((appointmentRows ?? []) as AppointmentRow[]).map(
    mapAppointment,
  );

  const today = new Date().toISOString();
  const nextAppointment =
    appointments.find(
      (a) => a.status === "scheduled" && a.date >= today,
    ) ??
    appointments.find((a) => a.status === "scheduled") ??
    null;

  const yearStart = `${new Date().getFullYear()}-01-01T00:00:00Z`;

  const { data: allSavingsRows } = await supabase
    .from("member_savings_transactions")
    .select(
      "saved_cents, regular_price_cents, member_price_cents, service_type, occurred_at",
    )
    .eq("member_profile_id", profile.id)
    .order("occurred_at", { ascending: false });

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
    .eq("property_id", propertyRow.id)
    .order("observed_at", { ascending: false })
    .limit(5);

  const observations = ((observationRows ?? []) as ObservationRow[]).map(
    mapObservation,
  );

  const memberProfile = buildMemberProfile(
    homeownerRow,
    profile,
    membershipRow,
    allSavingsEntries,
    appointments,
    nextAppointment,
    propertyRow.id,
  );

  return {
    profile: memberProfile,
    property: buildPropertyRecord(propertyRow, profile.id),
    appointments,
    nextAppointment,
    ytdSavings,
    lifetimeSavings,
    observations,
    membershipPlanName: membershipRow?.plan_name ?? "Preferred Care",
    monthlyRate: membershipRow
      ? parsePriceDisplay(membershipRow.price_display)
      : 0,
    memberSince: membershipRow?.started_at ?? profile.created_at,
    foundingMember: membershipRow?.founding_member ?? false,
    foundingMemberSince: membershipRow?.founding_member_since ?? null,
  };
}

export type {
  PersistedMemberAppointment,
  PersistedMemberSavingsTransaction,
};
