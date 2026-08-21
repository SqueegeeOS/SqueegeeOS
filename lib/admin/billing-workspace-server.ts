import { resolveAgreementPdfAccessUrl } from "@/lib/agreement/signed-agreement-storage";
import { resolveMemberEmail } from "@/lib/agreement/resolve-member-email";
import {
  deriveBillingStatus,
  resolveLastChargeDate,
  resolveNextChargeDate,
} from "@/lib/admin/billing-charge-dates";
import { isPaidBillingStatus } from "@/lib/admin/billing-ledger";
import type {
  BillingRegisterRow,
  BillingExecutionState,
  BillingStatus,
  BillingWorkspaceData,
  BillingWorkspaceOverview,
} from "@/lib/admin/billing-workspace-types";
import { resolvePortalPaymentMethodLabel } from "@/lib/membership/resolve-portal-payment-method";
import {
  hasPaymentMethodOnFile,
  isMembershipActive,
  resolveStripePaymentStatus,
} from "@/lib/membership/membership-status";
import { resolvePaymentSetupEmailState } from "@/lib/membership/payment-setup-email-state";
import {
  normalizeToSqueegeeKingTier,
  squeegeeKingTierLabel,
} from "@/lib/membership/tier-config";
import {
  createServerSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";
import { isStripeLiveMode } from "@/lib/stripe/mode";
import {
  AUTHORITATIVE_APPOINTMENT_MATCH_STATE,
  AUTHORITATIVE_APPOINTMENT_PROVENANCE_STATES,
  AUTHORITATIVE_APPOINTMENT_PROVIDER,
  AUTHORITATIVE_APPOINTMENT_VERIFICATION_STATE,
} from "@/lib/care-operations/model";
import { JOBBER_CONNECTION_ID } from "@/lib/care-operations/jobber-oauth-config";
import {
  automaticBillingMonthBounds,
  automaticBillingServiceMonth,
  dollarsToBillingCents,
} from "@/lib/billing/automatic-billing-rules";
import { isMembershipBillingAuthorized } from "@/lib/billing/membership-billing-authorization";
import {
  selectBillingWorkspaceVisit,
  type CompletedVisitBillingEvidence,
} from "@/lib/admin/billing-visit-selection";

interface MembershipBillingRow {
  id: string;
  homeowner_id: string;
  property_id: string;
  presentation_id: string | null;
  status: string;
  sales_tier: string | null;
  visit_price: number | null;
  membership_enrollment_savings: number | null;
  visits_per_year: number | null;
  started_at: string | null;
  payment_setup_completed_at: string | null;
  stripe_customer_id: string | null;
  stripe_payment_method_id: string | null;
  agreement_id: string | null;
  automatic_billing_enabled: boolean;
}

interface HomeownerBillingRow {
  id: string;
  full_name: string;
  email: string | null;
}

interface PresentationBillingRow {
  id: string;
  status: string;
  client_email: string | null;
}

interface PropertyBillingRow {
  id: string;
  name: string;
  address: string;
  city: string;
}

interface ObligationBillingRow {
  membership_id: string;
  target_window_start: string;
  status: string;
}

interface ChargeBillingRow {
  membership_id: string;
  appointment_id: string | null;
  service_month: string;
  status: string;
  charged_at: string | null;
  amount: number;
  amount_collected: number | null;
}

interface AgreementBillingRow {
  id: string;
  agreement_pdf_url: string | null;
  status: string;
  membership_id: string | null;
  property_id: string | null;
  billing_authorization_version: string | null;
  billing_authorized_at: string | null;
  authorized_visit_price_cents: number | null;
  billing_terms_hash: string | null;
}

interface AppointmentBillingRow {
  id: string;
  property_id: string;
  external_id: string;
  scheduled_at: string;
  status: string;
  completed_at: string | null;
}

interface VisitFieldEvidenceRow {
  visit_id: string;
  field_record_id: string | null;
  follow_up_status: string | null;
  customer_note_visible: boolean;
}

interface VisitVisibleAssetRow {
  visit_id: string;
}

interface JobberVisitProjectionBillingRow {
  external_visit_id: string;
  external_job_id: string;
  external_property_id: string;
  match_state: string;
  matched_property_id: string | null;
  job_total_cents: number | null;
  job_will_auto_charge: boolean;
  visit_invoice_id: string | null;
  visit_invoice_status: string | null;
}

interface JobberPropertyLinkBillingRow {
  external_property_id: string;
  membership_id: string;
  property_id: string;
}

interface BillingOrderWorkspaceRow {
  id: string;
  membership_id: string;
  service_month: string;
  execution_state: BillingExecutionState;
  failure_code: string | null;
  failure_message: string | null;
  attempt_count: number;
  next_attempt_at: string | null;
  created_at: string;
}

const EMPTY_OVERVIEW: BillingWorkspaceOverview = {
  readyToBillCount: 0,
  expectedRevenueThisMonth: 0,
  collectedThisMonth: 0,
  upcomingChargesCount: 0,
  activeMembershipCount: 0,
};

function formatPropertyLabel(property: PropertyBillingRow): string {
  return [property.name, property.address, property.city]
    .filter(Boolean)
    .join(" · ");
}

function buildOverview(
  rows: BillingRegisterRow[],
  allCharges: ChargeBillingRow[],
  referenceDate: Date,
): BillingWorkspaceOverview {
  const referenceYm = referenceDate.toISOString().slice(0, 7);
  let expectedRevenueThisMonth = 0;
  let collectedThisMonth = 0;
  let readyToBillCount = 0;
  let upcomingChargesCount = 0;

  for (const charge of allCharges) {
    if (!isPaidBillingStatus(charge.status)) continue;
    const chargedYm =
      charge.charged_at?.slice(0, 7) ?? charge.service_month.slice(0, 7);
    if (chargedYm === referenceYm) {
      collectedThisMonth += Number(charge.amount_collected ?? charge.amount);
    }
  }

  for (const row of rows) {
    if (row.billingStatus === "ready_to_charge") {
      readyToBillCount += 1;
      if (row.visitPrice != null) {
        expectedRevenueThisMonth +=
          row.jobberScheduledAmount ?? row.visitPrice;
      }
    }
    if (row.billingStatus === "upcoming") {
      upcomingChargesCount += 1;
    }
  }

  return {
    readyToBillCount,
    expectedRevenueThisMonth,
    collectedThisMonth,
    upcomingChargesCount,
    activeMembershipCount: rows.filter((row) => row.billingStatus !== "inactive")
      .length,
  };
}

export async function loadBillingWorkspace(): Promise<BillingWorkspaceData> {
  const loadedAt = new Date().toISOString();
  const stripeDashboardLive = isStripeLiveMode();
  const referenceDate = new Date();
  const completedVisitLookback = new Date(
    referenceDate.getTime() - 62 * 24 * 60 * 60 * 1_000,
  ).toISOString();

  if (!isSupabaseConfigured()) {
    return {
      overview: EMPTY_OVERVIEW,
      rows: [],
      loadedAt,
      stripeDashboardLive,
    };
  }

  const supabase = createServerSupabaseClient();

  const { data: memberships, error: membershipError } = await supabase
    .from("memberships")
    .select(
      "id, homeowner_id, property_id, presentation_id, status, sales_tier, visit_price, membership_enrollment_savings, visits_per_year, started_at, payment_setup_completed_at, stripe_customer_id, stripe_payment_method_id, agreement_id, automatic_billing_enabled",
    )
    .in("status", ["active", "pending_payment", "paused"])
    .order("started_at", { ascending: true });

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  const membershipRows = (memberships ?? []) as MembershipBillingRow[];
  if (membershipRows.length === 0) {
    return {
      overview: EMPTY_OVERVIEW,
      rows: [],
      loadedAt,
      stripeDashboardLive,
    };
  }

  const membershipIds = membershipRows.map((row) => row.id);
  const homeownerIds = [...new Set(membershipRows.map((row) => row.homeowner_id))];
  const propertyIds = [...new Set(membershipRows.map((row) => row.property_id))];
  const agreementIds = [
    ...new Set(
      membershipRows
        .map((row) => row.agreement_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const presentationIds = [
    ...new Set(
      membershipRows
        .map((row) => row.presentation_id)
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
    billingOrdersRes,
    propertyLinksRes,
    presentationsRes,
  ] = await Promise.all([
    supabase
      .from("homeowners")
      .select("id, full_name, email")
      .in("id", homeownerIds),
    supabase
      .from("properties")
      .select("id, name, address, city")
      .in("id", propertyIds),
    supabase
      .from("obligations")
      .select("membership_id, target_window_start, status")
      .in("membership_id", membershipIds)
      .order("target_window_start", { ascending: true }),
    supabase
      .from("membership_billing_charges")
      .select(
        "membership_id, appointment_id, service_month, status, charged_at, amount, amount_collected",
      )
      .in("membership_id", membershipIds)
      .order("service_month", { ascending: false }),
    agreementIds.length > 0
      ? supabase
          .from("signed_agreements")
          .select(
            "id, agreement_pdf_url, status, membership_id, property_id, billing_authorization_version, billing_authorized_at, authorized_visit_price_cents, billing_terms_hash",
          )
          .in("id", agreementIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("member_appointments")
      .select(
        "id, property_id, external_id, scheduled_at, status, completed_at",
      )
      .in("property_id", propertyIds)
      .eq("provider", AUTHORITATIVE_APPOINTMENT_PROVIDER)
      .in("provenance_state", [...AUTHORITATIVE_APPOINTMENT_PROVENANCE_STATES])
      .eq("verification_state", AUTHORITATIVE_APPOINTMENT_VERIFICATION_STATE)
      .eq("match_state", AUTHORITATIVE_APPOINTMENT_MATCH_STATE)
      .in("status", ["scheduled", "completed"])
      .gte("scheduled_at", completedVisitLookback)
      .order("scheduled_at", { ascending: true }),
    supabase
      .from("billing_orders")
      .select(
        "id, membership_id, service_month, execution_state, failure_code, failure_message, attempt_count, next_attempt_at, created_at",
      )
      .in("membership_id", membershipIds)
      .neq("execution_state", "void")
      .order("created_at", { ascending: false }),
    supabase
      .from("jobber_property_links")
      .select("external_property_id, membership_id, property_id")
      .in("membership_id", membershipIds)
      .eq("connection_id", JOBBER_CONNECTION_ID)
      .eq("link_state", "active"),
    presentationIds.length > 0
      ? supabase
          .from("presentations")
          .select("id, status, client_email")
          .in("id", presentationIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (homeownersRes.error) throw new Error(homeownersRes.error.message);
  if (propertiesRes.error) throw new Error(propertiesRes.error.message);
  if (obligationsRes.error) throw new Error(obligationsRes.error.message);

  const chargesAvailable = !chargesRes.error;
  if (chargesRes.error && !chargesRes.error.message.includes("does not exist")) {
    throw new Error(chargesRes.error.message);
  }
  if (agreementsRes.error) throw new Error(agreementsRes.error.message);
  if (appointmentsRes.error) throw new Error(appointmentsRes.error.message);
  if (billingOrdersRes.error) throw new Error(billingOrdersRes.error.message);
  if (propertyLinksRes.error) throw new Error(propertyLinksRes.error.message);
  if (presentationsRes.error) throw new Error(presentationsRes.error.message);

  const appointmentRows = (appointmentsRes.data ?? []) as AppointmentBillingRow[];
  const appointmentExternalIds = [
    ...new Set(appointmentRows.map((appointment) => appointment.external_id)),
  ];
  const appointmentIds = appointmentRows.map((appointment) => appointment.id);
  const [visitProjectionsRes, fieldEvidenceRes, visibleAssetsRes] =
    await Promise.all([
      appointmentExternalIds.length
        ? supabase
            .from("jobber_visit_projections")
            .select(
              "external_visit_id, external_job_id, external_property_id, match_state, matched_property_id, job_total_cents, job_will_auto_charge, visit_invoice_id, visit_invoice_status",
            )
            .eq("connection_id", JOBBER_CONNECTION_ID)
            .in("external_visit_id", appointmentExternalIds)
        : Promise.resolve({ data: [], error: null }),
      appointmentIds.length
        ? supabase
            .from("property_assessments")
            .select(
              "visit_id, field_record_id, follow_up_status, customer_note_visible",
            )
            .in("visit_id", appointmentIds)
        : Promise.resolve({ data: [], error: null }),
      appointmentIds.length
        ? supabase
            .from("property_assets")
            .select("visit_id")
            .in("visit_id", appointmentIds)
            .eq("kind", "photo")
            .eq("customer_visible", true)
        : Promise.resolve({ data: [], error: null }),
    ]);
  if (visitProjectionsRes.error) {
    throw new Error(visitProjectionsRes.error.message);
  }
  if (fieldEvidenceRes.error) throw new Error(fieldEvidenceRes.error.message);
  if (visibleAssetsRes.error) throw new Error(visibleAssetsRes.error.message);

  const homeownerById = new Map(
    ((homeownersRes.data ?? []) as HomeownerBillingRow[]).map((row) => [
      row.id,
      row,
    ]),
  );
  const propertyById = new Map(
    ((propertiesRes.data ?? []) as PropertyBillingRow[]).map((row) => [
      row.id,
      row,
    ]),
  );
  const obligationsByMembership = new Map<string, ObligationBillingRow[]>();
  for (const row of (obligationsRes.data ?? []) as ObligationBillingRow[]) {
    const list = obligationsByMembership.get(row.membership_id) ?? [];
    list.push(row);
    obligationsByMembership.set(row.membership_id, list);
  }
  const chargesByMembership = new Map<string, ChargeBillingRow[]>();
  if (chargesAvailable) {
    for (const row of (chargesRes.data ?? []) as ChargeBillingRow[]) {
      const list = chargesByMembership.get(row.membership_id) ?? [];
      list.push(row);
      chargesByMembership.set(row.membership_id, list);
    }
  }
  const agreementById = new Map(
    ((agreementsRes.data ?? []) as AgreementBillingRow[]).map((row) => [
      row.id,
      row,
    ]),
  );
  const presentationById = new Map(
    ((presentationsRes.data ?? []) as PresentationBillingRow[]).map((row) => [
      row.id,
      row,
    ]),
  );
  const appointmentsByProperty = new Map<string, AppointmentBillingRow[]>();
  for (const appointment of appointmentRows) {
    const list = appointmentsByProperty.get(appointment.property_id) ?? [];
    list.push(appointment);
    appointmentsByProperty.set(appointment.property_id, list);
  }
  const projectionByExternalVisitId = new Map(
    ((visitProjectionsRes.data ?? []) as JobberVisitProjectionBillingRow[]).map(
      (projection) => [projection.external_visit_id, projection],
    ),
  );
  const completedEvidenceByAppointmentId = new Map<
    string,
    CompletedVisitBillingEvidence
  >();
  for (const row of (fieldEvidenceRes.data ?? []) as VisitFieldEvidenceRow[]) {
    const current = completedEvidenceByAppointmentId.get(row.visit_id) ?? {
      hasFieldRecord: false,
      hasCustomerVisibleUpdate: false,
      hasOpenFollowUp: false,
    };
    completedEvidenceByAppointmentId.set(row.visit_id, {
      hasFieldRecord: current.hasFieldRecord || Boolean(row.field_record_id),
      hasCustomerVisibleUpdate:
        current.hasCustomerVisibleUpdate || row.customer_note_visible,
      hasOpenFollowUp:
        current.hasOpenFollowUp || row.follow_up_status === "open",
    });
  }
  for (const row of (visibleAssetsRes.data ?? []) as VisitVisibleAssetRow[]) {
    const current = completedEvidenceByAppointmentId.get(row.visit_id) ?? {
      hasFieldRecord: false,
      hasCustomerVisibleUpdate: false,
      hasOpenFollowUp: false,
    };
    completedEvidenceByAppointmentId.set(row.visit_id, {
      ...current,
      hasCustomerVisibleUpdate: true,
    });
  }
  const activePropertyLinkKeys = new Set(
    ((propertyLinksRes.data ?? []) as JobberPropertyLinkBillingRow[]).map(
      (link) =>
        `${link.membership_id}:${link.property_id}:${link.external_property_id}`,
    ),
  );
  const billingOrdersByMembership = new Map<string, BillingOrderWorkspaceRow[]>();
  for (const order of (billingOrdersRes.data ?? []) as BillingOrderWorkspaceRow[]) {
    const list = billingOrdersByMembership.get(order.membership_id) ?? [];
    list.push(order);
    billingOrdersByMembership.set(order.membership_id, list);
  }

  const allCharges: ChargeBillingRow[] = chargesAvailable
    ? ((chargesRes.data ?? []) as ChargeBillingRow[])
    : [];

  const referenceYm = referenceDate.toISOString().slice(0, 7);
  const currentServiceMonth =
    automaticBillingMonthBounds(referenceDate).serviceMonth;

  const rows: BillingRegisterRow[] = [];

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
    const chargeInputs = charges.map((row) => ({
      serviceMonth: row.service_month,
      status: row.status as "paid" | "charged" | "failed" | "pending",
      chargedAt: row.charged_at,
    }));
    const billingVisitCandidates = (
      appointmentsByProperty.get(membership.property_id) ?? []
    ).filter((appointment) => {
      const projection = projectionByExternalVisitId.get(
        appointment.external_id,
      );
      return Boolean(
        projection &&
          projection.match_state === AUTHORITATIVE_APPOINTMENT_MATCH_STATE &&
          projection.matched_property_id === membership.property_id &&
          projection.job_total_cents !== null &&
          projection.job_total_cents > 0 &&
          projection.job_will_auto_charge === false &&
          projection.visit_invoice_id === null &&
          projection.visit_invoice_status === "NONE" &&
          activePropertyLinkKeys.has(
            `${membership.id}:${membership.property_id}:${projection.external_property_id}`,
          ),
      );
    });
    const nextAppointment = selectBillingWorkspaceVisit({
      candidates: billingVisitCandidates.map((appointment) => ({
        id: appointment.id,
        scheduledAt: appointment.scheduled_at,
        status: appointment.status,
      })),
      completedEvidenceByAppointmentId,
      currentServiceMonth,
    });
    const nextAppointmentRow = nextAppointment
      ? billingVisitCandidates.find(
          (appointment) => appointment.id === nextAppointment.id,
        ) ?? null
      : null;
    const appointmentBillingPeriod = nextAppointment
      ? automaticBillingServiceMonth(nextAppointment.scheduledAt)
      : null;
    const nextProjection = nextAppointmentRow
      ? projectionByExternalVisitId.get(nextAppointmentRow.external_id) ?? null
      : null;
    const membershipBillingOrders =
      billingOrdersByMembership.get(membership.id) ?? [];
    const currentActionableOrder = membershipBillingOrders.find(
      (order) =>
        order.service_month.startsWith(referenceYm) &&
        order.execution_state !== "succeeded",
    );
    const obligationBillingPeriod = resolveNextChargeDate(
      obligationInputs,
      referenceDate,
      paidServiceMonths,
    );
    const billingPeriod =
      currentActionableOrder?.service_month ??
      appointmentBillingPeriod ??
      obligationBillingPeriod;
    const nextChargeDate = billingPeriod;
    const lastChargeDate = resolveLastChargeDate(chargeInputs);
    const paymentOnFile = hasPaymentMethodOnFile(membership);
    const membershipActive = isMembershipActive(membership);

    const serviceMonthKey = billingPeriod
      ? `${billingPeriod.slice(0, 7)}-01`
      : null;
    const periodCharge = serviceMonthKey
      ? charges.find(
          (row) =>
            row.service_month.startsWith(serviceMonthKey.slice(0, 7)) &&
            (!nextAppointment || row.appointment_id === nextAppointment.id),
        )
      : null;
    const periodAlreadyPaid = periodCharge
      ? isPaidBillingStatus(periodCharge.status)
      : false;
    const latestChargeForMonth = periodCharge?.status ?? null;
    const billingOrder =
      currentActionableOrder ??
      (billingPeriod
        ? membershipBillingOrders.find((order) =>
            order.service_month.startsWith(billingPeriod.slice(0, 7)),
          ) ?? null
        : null);

    let billingStatus: BillingStatus = deriveBillingStatus({
      membershipActive,
      paymentOnFile,
      nextChargeDate,
      latestChargeStatus: latestChargeForMonth as
        | "paid"
        | "charged"
        | "failed"
        | "pending"
        | null,
      referenceDate,
    });
    if (!nextAppointment && billingStatus === "ready_to_charge") {
      billingStatus = "upcoming";
    }

    const chargedThisMonth = charges.find((row) => {
      if (!isPaidBillingStatus(row.status)) return false;
      if (nextAppointment && row.appointment_id !== nextAppointment.id) {
        return false;
      }
      const chargedYm =
        row.charged_at?.slice(0, 7) ?? row.service_month.slice(0, 7);
      return chargedYm === referenceYm;
    });
    if (chargedThisMonth) {
      billingStatus = "charged";
    } else if (billingOrder?.execution_state === "succeeded") {
      billingStatus = "charged";
    } else if (
      billingOrder &&
      [
        "failed_retryable",
        "needs_action",
        "permanently_failed",
        "reconciliation_required",
      ].includes(
        billingOrder.execution_state,
      )
    ) {
      billingStatus = "failed";
    }

    const cardOnFileLabel = paymentOnFile
      ? await resolvePortalPaymentMethodLabel(membership.stripe_payment_method_id)
      : null;

    const agreement = membership.agreement_id
      ? agreementById.get(membership.agreement_id)
      : null;
    const presentation = membership.presentation_id
      ? presentationById.get(membership.presentation_id)
      : null;
    const paymentSetupEmailRecipient = resolveMemberEmail(
      presentation?.client_email,
      homeowner.email,
    );
    const paymentSetupEmailState = resolvePaymentSetupEmailState({
      membershipStatus: membership.status,
      paymentSetupCompletedAt: membership.payment_setup_completed_at,
      stripePaymentMethodId: membership.stripe_payment_method_id,
      customerEmail: paymentSetupEmailRecipient,
      presentationStatus: presentation?.status,
      agreementStatus: agreement?.status,
      billingAuthorizationVersion:
        agreement?.billing_authorization_version,
      billingAuthorizedAt: agreement?.billing_authorized_at,
      billingTermsHash: agreement?.billing_terms_hash,
    });
    const agreementPdfUrl = agreement?.agreement_pdf_url
      ? await resolveAgreementPdfAccessUrl(agreement.agreement_pdf_url)
      : null;
    const billingAuthorizationReady = isMembershipBillingAuthorized({
      agreementId: membership.agreement_id,
      agreementStatus: agreement?.status ?? null,
      agreementMembershipId: agreement?.membership_id ?? null,
      agreementPropertyId: agreement?.property_id ?? null,
      billingAuthorizationVersion:
        agreement?.billing_authorization_version ?? null,
      billingAuthorizedAt: agreement?.billing_authorized_at ?? null,
      billingTermsHash: agreement?.billing_terms_hash ?? null,
      authorizedVisitPriceCents:
        agreement?.authorized_visit_price_cents ?? null,
      membershipId: membership.id,
      propertyId: membership.property_id,
      currentVisitPriceCents:
        membership.visit_price === null
          ? null
          : dollarsToBillingCents(Number(membership.visit_price)),
    });

    const tierId = normalizeToSqueegeeKingTier(
      membership.sales_tier ?? "quarterly",
    );

    rows.push({
      membershipId: membership.id,
      homeownerId: membership.homeowner_id,
      propertyId: membership.property_id,
      homeownerName: homeowner.full_name,
      propertyLabel: formatPropertyLabel(property),
      tierLabel: squeegeeKingTierLabel(tierId),
      visitPrice:
        membership.visit_price != null ? Number(membership.visit_price) : null,
      jobberScheduledAmount:
        nextProjection?.job_total_cents == null
          ? null
          : nextProjection.job_total_cents / 100,
      enrollmentSavingsPerVisit:
        membership.membership_enrollment_savings != null
          ? Number(membership.membership_enrollment_savings)
          : null,
      nextAppointmentId:
        nextAppointment?.id ?? null,
      nextAppointmentDate:
        nextAppointmentRow?.completed_at ??
        nextAppointment?.scheduledAt ??
        null,
      stripePaymentStatus: resolveStripePaymentStatus(membership),
      paymentSetupEmailState,
      paymentSetupEmailRecipient,
      cardOnFileLabel,
      stripeCustomerId: membership.stripe_customer_id,
      nextChargeDate,
      lastChargeDate,
      billingPeriod,
      periodAlreadyPaid,
      canRecordCharge:
        membershipActive &&
        paymentOnFile &&
        Boolean(nextAppointment) &&
        !periodAlreadyPaid &&
        (billingStatus === "ready_to_charge" || billingStatus === "failed"),
      billingStatus,
      agreementId: membership.agreement_id,
      agreementPdfUrl,
      chargeAction: "complete_and_charge",
      automaticBillingEnabled: membership.automatic_billing_enabled,
      billingAuthorizationReady,
      jobberPropertyPaired: [...activePropertyLinkKeys].some((key) =>
        key.startsWith(`${membership.id}:${membership.property_id}:`),
      ),
      verifiedServiceVisitReady: Boolean(nextAppointment),
      billingOrderId: billingOrder?.id ?? null,
      billingExecutionState: billingOrder?.execution_state ?? null,
      billingFailureCode: billingOrder?.failure_code ?? null,
      billingFailureMessage: billingOrder?.failure_message ?? null,
      billingAttemptCount: billingOrder?.attempt_count ?? 0,
      billingNextAttemptAt: billingOrder?.next_attempt_at ?? null,
    });
  }

  rows.sort((a, b) => {
    const statusOrder: Record<BillingStatus, number> = {
      ready_to_charge: 0,
      failed: 1,
      upcoming: 2,
      charged: 3,
      inactive: 4,
    };
    const byStatus = statusOrder[a.billingStatus] - statusOrder[b.billingStatus];
    if (byStatus !== 0) return byStatus;
    if (a.nextChargeDate && b.nextChargeDate) {
      return a.nextChargeDate.localeCompare(b.nextChargeDate);
    }
    return a.homeownerName.localeCompare(b.homeownerName);
  });

  return {
    overview: buildOverview(rows, allCharges, referenceDate),
    rows,
    loadedAt,
    stripeDashboardLive,
  };
}
