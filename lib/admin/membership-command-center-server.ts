import { resolveAgreementPdfAccessUrl } from "@/lib/agreement/signed-agreement-storage";
import { resolveNextChargeDate } from "@/lib/admin/billing-charge-dates";
import { isPaidBillingStatus } from "@/lib/admin/billing-ledger";
import type { StripePaymentStatus } from "@/lib/admin/billing-workspace-types";
import type {
  MembershipCommandCenterData,
  MembershipHealthBadge,
  MembershipMemberRow,
  MembershipMonthDueRow,
  MembershipMonthView,
  PendingMemberReason,
} from "@/lib/admin/membership-command-center-types";
import { buildPortalAccessUrl } from "@/lib/membership/portal-access";
import { resolvePortalPaymentMethodLabel } from "@/lib/membership/resolve-portal-payment-method";
import {
  normalizeToSqueegeeKingTier,
  SQUEEGEEKING_TIERS,
} from "@/lib/membership/tier-config";
import {
  createServerSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";

interface MembershipRow {
  id: string;
  homeowner_id: string;
  property_id: string;
  presentation_id: string | null;
  agreement_id: string | null;
  status: string;
  sales_tier: string | null;
  plan_name: string | null;
  visit_price: number | null;
  annual_rate: number | null;
  visits_per_year: number | null;
  started_at: string | null;
  payment_setup_completed_at: string | null;
  stripe_customer_id: string | null;
  stripe_payment_method_id: string | null;
  portal_access_token: string | null;
  founding_member: boolean;
}

interface HomeownerRow {
  id: string;
  slug: string;
  full_name: string;
}

interface PropertyRow {
  id: string;
  name: string;
  address: string;
  city: string;
  slug: string;
}

interface ObligationRow {
  membership_id: string;
  target_window_start: string;
  status: string;
}

interface ChargeRow {
  membership_id: string;
  service_month: string;
  status: string;
}

interface AppointmentRow {
  property_id: string;
  scheduled_at: string;
  status: string;
}

interface AgreementRow {
  id: string;
  agreement_pdf_url: string | null;
}

interface PresentationPendingRow {
  id: string;
  client_name: string;
  client_address: string;
  status: string;
  homeowner_id: string | null;
  property_id: string | null;
  membership_id: string | null;
  tier: string;
}

const EMPTY_MONTH_VIEW = (referenceDate: Date): MembershipMonthView => {
  const referenceMonth = referenceDate.toISOString().slice(0, 7);
  return {
    referenceMonth,
    referenceMonthLabel: referenceDate.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
    membersDueCount: 0,
    expectedRevenue: 0,
    visitsByPlanType: { quarterly: 0, biannual: 0, unknown: 0 },
    dueMembers: [],
    missingDataFlags: [],
  };
};

function resolveStripePaymentStatus(
  row: Pick<
    MembershipRow,
    | "stripe_payment_method_id"
    | "payment_setup_completed_at"
    | "stripe_customer_id"
    | "status"
  >,
): StripePaymentStatus {
  if (row.stripe_payment_method_id && row.payment_setup_completed_at) {
    return "card_on_file";
  }
  if (row.stripe_customer_id) {
    return "customer_only";
  }
  if (
    (row.status === "active" || row.status === "pending_payment") &&
    !row.payment_setup_completed_at
  ) {
    return "payment_pending";
  }
  return "not_configured";
}

function formatPropertyLabel(property: PropertyRow): string {
  return [property.name, property.address, property.city]
    .filter(Boolean)
    .join(" · ");
}

function planTypeFromTier(
  salesTier: string | null,
  planName: string | null,
): "Quarterly" | "Bi-Annual" | "Unknown" {
  const tierId = normalizeToSqueegeeKingTier(
    salesTier ?? planName ?? "quarterly",
  );
  if (tierId === "quarterly") return "Quarterly";
  if (tierId === "biannual") return "Bi-Annual";
  return "Unknown";
}

function resolveYearlyValue(
  visitPrice: number | null,
  visitsPerYear: number | null,
  annualRate: number | null,
  salesTier: string | null,
): number | null {
  if (annualRate != null && annualRate > 0) {
    return Number(annualRate);
  }
  const visits =
    visitsPerYear ??
    SQUEEGEEKING_TIERS[normalizeToSqueegeeKingTier(salesTier ?? "quarterly")]
      .visitsPerYear;
  if (visitPrice != null && visits > 0) {
    return visitPrice * visits;
  }
  return null;
}

function buildPortalUrl(
  token: string | null,
  homeownerSlug: string | null,
  propertySlug: string | null,
): string | null {
  if (token) {
    return buildPortalAccessUrl(token);
  }
  if (homeownerSlug && propertySlug) {
    return `/homecare/${homeownerSlug}/${propertySlug}/portal`;
  }
  return null;
}

function formatServiceDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function resolveNextService(
  appointment: AppointmentRow | null,
  nextChargeDate: string | null,
  openObligationStart: string | null,
): { date: string | null; label: string | null } {
  if (appointment?.status === "scheduled") {
    const date = appointment.scheduled_at.slice(0, 10);
    return {
      date,
      label: formatServiceDate(appointment.scheduled_at),
    };
  }
  if (nextChargeDate) {
    return {
      date: nextChargeDate,
      label: `${formatServiceDate(`${nextChargeDate}T12:00:00Z`)} (service month)`,
    };
  }
  if (openObligationStart) {
    return {
      date: openObligationStart,
      label: `${formatServiceDate(`${openObligationStart}T12:00:00Z`)} (window)`,
    };
  }
  return { date: null, label: null };
}

function isDueThisMonth(
  nextChargeDate: string | null,
  referenceYm: string,
): boolean {
  if (!nextChargeDate) return false;
  return nextChargeDate.slice(0, 7) === referenceYm;
}

function isPastDue(
  nextChargeDate: string | null,
  referenceDate: Date,
  paidThisPeriod: boolean,
): boolean {
  if (!nextChargeDate || paidThisPeriod) return false;
  const today = referenceDate.toISOString().slice(0, 10);
  const currentYm = referenceDate.toISOString().slice(0, 7);
  const chargeYm = nextChargeDate.slice(0, 7);
  return chargeYm < currentYm || (nextChargeDate < today && chargeYm === currentYm);
}

function resolvePendingReason(
  membership: MembershipRow,
  hasSignedAgreement: boolean,
): PendingMemberReason | null {
  const paymentOnFile = Boolean(membership.payment_setup_completed_at);
  const hasAgreement = Boolean(membership.agreement_id) || hasSignedAgreement;

  if (hasAgreement && !paymentOnFile) {
    return "signed_missing_card";
  }
  if (paymentOnFile && membership.status !== "active") {
    return "card_not_active";
  }
  if (
    membership.status === "pending_payment" ||
    membership.status === "pending_checkout" ||
    membership.status === "inactive"
  ) {
    if (!hasAgreement) return null;
    return "signed_missing_card";
  }
  return null;
}

function buildHealthBadges(input: {
  isActive: boolean;
  paymentStatus: StripePaymentStatus;
  pendingReason: PendingMemberReason | null;
  dueThisMonth: boolean;
  pastDue: boolean;
  needsScheduling: boolean;
}): MembershipHealthBadge[] {
  const badges: MembershipHealthBadge[] = [];

  if (input.isActive) {
    badges.push("active");
  }
  if (
    input.paymentStatus === "payment_pending" ||
    input.paymentStatus === "not_configured" ||
    input.pendingReason === "signed_missing_card"
  ) {
    badges.push("needs_card");
  }
  if (input.needsScheduling && input.isActive) {
    badges.push("needs_scheduling");
  }
  if (input.dueThisMonth) {
    badges.push("due_this_month");
  }
  if (input.pastDue) {
    badges.push("past_due");
  }
  if (input.pendingReason === "card_not_active") {
    badges.push("attention");
  }

  return [...new Set(badges)];
}

function buildMissingFlags(input: {
  visitPrice: number | null;
  yearlyValue: number | null;
  nextServiceLabel: string | null;
  paymentStatus: StripePaymentStatus;
  obligationsCount: number;
  isActive: boolean;
}): string[] {
  const flags: string[] = [];
  if (input.visitPrice == null) flags.push("Visit price unknown");
  if (input.yearlyValue == null) flags.push("Yearly value unknown");
  if (input.isActive && !input.nextServiceLabel) {
    flags.push("Next service not scheduled");
  }
  if (
    input.isActive &&
    input.obligationsCount === 0 &&
    input.paymentStatus === "card_on_file"
  ) {
    flags.push("Service obligations not generated");
  }
  if (input.paymentStatus === "payment_pending") {
    flags.push("Card not on file");
  }
  return flags;
}

export async function loadMembershipCommandCenter(): Promise<MembershipCommandCenterData> {
  const loadedAt = new Date().toISOString();
  const referenceDate = new Date();
  const referenceYm = referenceDate.toISOString().slice(0, 7);

  if (!isSupabaseConfigured()) {
    return {
      connected: false,
      loadedAt,
      summary: {
        activeCount: 0,
        pendingCount: 0,
        needsCardCount: 0,
        dueThisMonthCount: 0,
        pastDueCount: 0,
        needsSchedulingCount: 0,
      },
      activeMembers: [],
      pendingMembers: [],
      monthView: EMPTY_MONTH_VIEW(referenceDate),
    };
  }

  const supabase = createServerSupabaseClient();

  const { data: memberships, error: membershipError } = await supabase
    .from("memberships")
    .select(
      "id, homeowner_id, property_id, presentation_id, agreement_id, status, sales_tier, plan_name, visit_price, annual_rate, visits_per_year, started_at, payment_setup_completed_at, stripe_customer_id, stripe_payment_method_id, portal_access_token, founding_member",
    )
    .neq("status", "cancelled")
    .order("created_at", { ascending: true });

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  const membershipRows = (memberships ?? []) as MembershipRow[];

  const homeownerIds = [
    ...new Set(membershipRows.map((row) => row.homeowner_id)),
  ];
  const propertyIds = [
    ...new Set(membershipRows.map((row) => row.property_id)),
  ];
  const membershipIds = membershipRows.map((row) => row.id);
  const agreementIds = [
    ...new Set(
      membershipRows
        .map((row) => row.agreement_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [
    homeownersRes,
    propertiesRes,
    obligationsRes,
    chargesRes,
    agreementsRes,
    appointmentsRes,
    presentationsRes,
  ] = await Promise.all([
    homeownerIds.length > 0
      ? supabase
          .from("homeowners")
          .select("id, slug, full_name")
          .in("id", homeownerIds)
      : Promise.resolve({ data: [], error: null }),
    propertyIds.length > 0
      ? supabase
          .from("properties")
          .select("id, name, address, city, slug")
          .in("id", propertyIds)
      : Promise.resolve({ data: [], error: null }),
    membershipIds.length > 0
      ? supabase
          .from("obligations")
          .select("membership_id, target_window_start, status")
          .in("membership_id", membershipIds)
          .order("target_window_start", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    membershipIds.length > 0
      ? supabase
          .from("membership_billing_charges")
          .select("membership_id, service_month, status")
          .in("membership_id", membershipIds)
      : Promise.resolve({ data: [], error: null }),
    agreementIds.length > 0
      ? supabase
          .from("signed_agreements")
          .select("id, agreement_pdf_url")
          .in("id", agreementIds)
      : Promise.resolve({ data: [], error: null }),
    propertyIds.length > 0
      ? supabase
          .from("member_appointments")
          .select("property_id, scheduled_at, status")
          .in("property_id", propertyIds)
          .eq("status", "scheduled")
          .gte("scheduled_at", referenceDate.toISOString())
          .order("scheduled_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("presentations")
      .select(
        "id, client_name, client_address, status, homeowner_id, property_id, membership_id, tier",
      )
      .eq("status", "presented")
      .is("signed_at", null),
  ]);

  if (homeownersRes.error) throw new Error(homeownersRes.error.message);
  if (propertiesRes.error) throw new Error(propertiesRes.error.message);
  if (obligationsRes.error) throw new Error(obligationsRes.error.message);
  if (agreementsRes.error) throw new Error(agreementsRes.error.message);
  if (appointmentsRes.error) throw new Error(appointmentsRes.error.message);
  if (presentationsRes.error) throw new Error(presentationsRes.error.message);

  const chargesAvailable = !chargesRes.error;
  if (chargesRes.error && !chargesRes.error.message.includes("does not exist")) {
    throw new Error(chargesRes.error.message);
  }

  const homeownerById = new Map(
    ((homeownersRes.data ?? []) as HomeownerRow[]).map((row) => [row.id, row]),
  );
  const propertyById = new Map(
    ((propertiesRes.data ?? []) as PropertyRow[]).map((row) => [row.id, row]),
  );
  const obligationsByMembership = new Map<string, ObligationRow[]>();
  for (const row of (obligationsRes.data ?? []) as ObligationRow[]) {
    const list = obligationsByMembership.get(row.membership_id) ?? [];
    list.push(row);
    obligationsByMembership.set(row.membership_id, list);
  }
  const chargesByMembership = new Map<string, ChargeRow[]>();
  if (chargesAvailable) {
    for (const row of (chargesRes.data ?? []) as ChargeRow[]) {
      const list = chargesByMembership.get(row.membership_id) ?? [];
      list.push(row);
      chargesByMembership.set(row.membership_id, list);
    }
  }
  const agreementById = new Map(
    ((agreementsRes.data ?? []) as AgreementRow[]).map((row) => [row.id, row]),
  );
  const nextAppointmentByProperty = new Map<string, AppointmentRow>();
  for (const row of (appointmentsRes.data ?? []) as AppointmentRow[]) {
    if (!nextAppointmentByProperty.has(row.property_id)) {
      nextAppointmentByProperty.set(row.property_id, row);
    }
  }

  const activeMembers: MembershipMemberRow[] = [];
  const pendingMembers: MembershipMemberRow[] = [];
  const dueMembers: MembershipMonthDueRow[] = [];
  const monthMissingFlags = new Set<string>();
  const visitsByPlanType = { quarterly: 0, biannual: 0, unknown: 0 };
  let expectedRevenue = 0;

  for (const membership of membershipRows) {
    const homeowner = homeownerById.get(membership.homeowner_id);
    const property = propertyById.get(membership.property_id);
    if (!homeowner || !property) continue;

    const obligations = obligationsByMembership.get(membership.id) ?? [];
    const charges = chargesByMembership.get(membership.id) ?? [];
    const obligationInputs = obligations.map((row) => ({
      targetWindowStart: row.target_window_start,
      status: row.status,
    }));
    const paidServiceMonths = charges
      .filter((row) => isPaidBillingStatus(row.status))
      .map((row) => row.service_month);
    const nextChargeDate = resolveNextChargeDate(
      obligationInputs,
      referenceDate,
      paidServiceMonths,
    );
    const openObligation = obligations.find(
      (row) =>
        !["completed", "waived", "void", "credited"].includes(row.status),
    );
    const appointment = nextAppointmentByProperty.get(membership.property_id) ?? null;
    const nextService = resolveNextService(
      appointment,
      nextChargeDate,
      openObligation?.target_window_start ?? null,
    );

    const paymentOnFile = Boolean(membership.payment_setup_completed_at);
    const isActive = membership.status === "active" && paymentOnFile;
    const paymentStatus = resolveStripePaymentStatus(membership);
    const planType = planTypeFromTier(membership.sales_tier, membership.plan_name);
    const visitPrice =
      membership.visit_price != null ? Number(membership.visit_price) : null;
    const yearlyValue = resolveYearlyValue(
      visitPrice,
      membership.visits_per_year,
      membership.annual_rate != null ? Number(membership.annual_rate) : null,
      membership.sales_tier,
    );

    const periodCharge = nextChargeDate
      ? charges.find((row) =>
          row.service_month.startsWith(nextChargeDate.slice(0, 7)),
        )
      : null;
    const paidThisPeriod = periodCharge
      ? isPaidBillingStatus(periodCharge.status)
      : false;
    const dueThisMonth = isDueThisMonth(nextChargeDate, referenceYm);
    const pastDue = isPastDue(nextChargeDate, referenceDate, paidThisPeriod);
    const needsScheduling =
      isActive && !appointment && Boolean(openObligation ?? nextChargeDate);

    const agreement = membership.agreement_id
      ? agreementById.get(membership.agreement_id)
      : null;
    const agreementPdfUrl = agreement?.agreement_pdf_url
      ? await resolveAgreementPdfAccessUrl(agreement.agreement_pdf_url)
      : null;

    const pendingReason = isActive
      ? null
      : resolvePendingReason(membership, Boolean(agreement));

    const cardLabel = paymentOnFile
      ? await resolvePortalPaymentMethodLabel(membership.stripe_payment_method_id)
      : null;

    const missingFlags = buildMissingFlags({
      visitPrice,
      yearlyValue,
      nextServiceLabel: nextService.label,
      paymentStatus,
      obligationsCount: obligations.length,
      isActive,
    });

    const row: MembershipMemberRow = {
      membershipId: membership.id,
      presentationId: membership.presentation_id,
      homeownerId: membership.homeowner_id,
      propertyId: membership.property_id,
      homeownerName: homeowner.full_name,
      propertyName: property.name,
      propertyLabel: formatPropertyLabel(property),
      homeownerSlug: homeowner.slug,
      propertySlug: property.slug,
      planType,
      visitPrice,
      yearlyValue,
      visitsPerYear: membership.visits_per_year,
      nextServiceDate: nextService.date,
      nextServiceLabel: nextService.label,
      paymentStatus,
      cardLabel,
      membershipStatus: membership.status,
      healthBadges: buildHealthBadges({
        isActive,
        paymentStatus,
        pendingReason,
        dueThisMonth,
        pastDue,
        needsScheduling,
      }),
      missingFlags,
      portalUrl: buildPortalUrl(
        membership.portal_access_token,
        homeowner.slug,
        property.slug,
      ),
      agreementId: membership.agreement_id,
      agreementPdfUrl,
      foundingMember: membership.founding_member,
      isActive,
      pendingReason,
    };

    if (isActive) {
      activeMembers.push(row);
    } else if (pendingReason) {
      pendingMembers.push(row);
    } else if (
      membership.status === "pending_payment" ||
      membership.status === "pending_checkout" ||
      membership.status === "inactive" ||
      membership.status === "paused"
    ) {
      pendingMembers.push({
        ...row,
        pendingReason: pendingReason ?? "signed_missing_card",
      });
    }

    if (isActive && dueThisMonth) {
      dueMembers.push({
        membershipId: membership.id,
        homeownerName: homeowner.full_name,
        propertyLabel: formatPropertyLabel(property),
        planType,
        visitPrice,
        missingFlags,
      });
      if (visitPrice != null) {
        expectedRevenue += visitPrice;
      } else {
        monthMissingFlags.add("Some due members are missing visit price");
      }
      if (planType === "Quarterly") visitsByPlanType.quarterly += 1;
      else if (planType === "Bi-Annual") visitsByPlanType.biannual += 1;
      else visitsByPlanType.unknown += 1;
    }
  }

  const membershipIdsWithPendingAgreement = new Set(
    pendingMembers
      .map((row) => row.membershipId)
      .filter((id): id is string => Boolean(id)),
  );

  for (const presentation of (presentationsRes.data ??
    []) as PresentationPendingRow[]) {
    if (
      presentation.membership_id &&
      membershipIdsWithPendingAgreement.has(presentation.membership_id)
    ) {
      continue;
    }

    const homeowner = presentation.homeowner_id
      ? homeownerById.get(presentation.homeowner_id)
      : null;
    const property = presentation.property_id
      ? propertyById.get(presentation.property_id)
      : null;

    if (!homeowner && !presentation.client_name) continue;

    const planType = planTypeFromTier(presentation.tier, null);

    pendingMembers.push({
      membershipId: presentation.membership_id,
      presentationId: presentation.id,
      homeownerId: presentation.homeowner_id ?? homeowner?.id ?? presentation.id,
      propertyId: presentation.property_id,
      homeownerName: homeowner?.full_name ?? presentation.client_name,
      propertyName: property?.name ?? "Property TBD",
      propertyLabel: property
        ? formatPropertyLabel(property)
        : presentation.client_address || "Address unknown",
      homeownerSlug: homeowner?.slug ?? null,
      propertySlug: property?.slug ?? null,
      planType,
      visitPrice: null,
      yearlyValue: null,
      visitsPerYear: null,
      nextServiceDate: null,
      nextServiceLabel: null,
      paymentStatus: "not_configured",
      cardLabel: null,
      membershipStatus: null,
      healthBadges: ["attention"],
      missingFlags: ["Agreement presented but not signed"],
      portalUrl: null,
      agreementId: null,
      agreementPdfUrl: null,
      foundingMember: false,
      isActive: false,
      pendingReason: "agreement_not_signed",
    });
  }

  activeMembers.sort((a, b) => a.homeownerName.localeCompare(b.homeownerName));
  pendingMembers.sort((a, b) => a.homeownerName.localeCompare(b.homeownerName));
  dueMembers.sort((a, b) => a.homeownerName.localeCompare(b.homeownerName));

  const summary = {
    activeCount: activeMembers.length,
    pendingCount: pendingMembers.length,
    needsCardCount: [...activeMembers, ...pendingMembers].filter((row) =>
      row.healthBadges.includes("needs_card"),
    ).length,
    dueThisMonthCount: dueMembers.length,
    pastDueCount: activeMembers.filter((row) =>
      row.healthBadges.includes("past_due"),
    ).length,
    needsSchedulingCount: activeMembers.filter((row) =>
      row.healthBadges.includes("needs_scheduling"),
    ).length,
  };

  const monthView: MembershipMonthView = {
    referenceMonth: referenceYm,
    referenceMonthLabel: referenceDate.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
    membersDueCount: dueMembers.length,
    expectedRevenue,
    visitsByPlanType,
    dueMembers,
    missingDataFlags: [...monthMissingFlags],
  };

  return {
    connected: true,
    loadedAt,
    summary,
    activeMembers,
    pendingMembers,
    monthView,
  };
}
