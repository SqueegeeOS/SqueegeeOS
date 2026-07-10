import { resolveAgreementPdfAccessUrl } from "@/lib/agreement/signed-agreement-storage";
import {
  deriveBillingStatus,
  resolveLastChargeDate,
  resolveNextChargeDate,
} from "@/lib/admin/billing-charge-dates";
import { isPaidBillingStatus } from "@/lib/admin/billing-ledger";
import type {
  BillingRegisterRow,
  BillingStatus,
  BillingWorkspaceData,
  BillingWorkspaceOverview,
  StripePaymentStatus,
} from "@/lib/admin/billing-workspace-types";
import { resolvePortalPaymentMethodLabel } from "@/lib/membership/resolve-portal-payment-method";
import {
  hasPaymentMethodOnFile,
  isMembershipActive,
  resolveStripePaymentStatus,
} from "@/lib/membership/membership-status";
import {
  normalizeToSqueegeeKingTier,
  squeegeeKingTierLabel,
} from "@/lib/membership/tier-config";
import {
  createServerSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";
import { isStripeLiveMode } from "@/lib/stripe/mode";

interface MembershipBillingRow {
  id: string;
  homeowner_id: string;
  property_id: string;
  status: string;
  sales_tier: string | null;
  visit_price: number | null;
  visits_per_year: number | null;
  started_at: string | null;
  payment_setup_completed_at: string | null;
  stripe_customer_id: string | null;
  stripe_payment_method_id: string | null;
  agreement_id: string | null;
}

interface HomeownerBillingRow {
  id: string;
  full_name: string;
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
  service_month: string;
  status: string;
  charged_at: string | null;
  amount: number;
  amount_collected: number | null;
}

interface AgreementBillingRow {
  id: string;
  agreement_pdf_url: string | null;
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
        expectedRevenueThisMonth += row.visitPrice;
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
      "id, homeowner_id, property_id, status, sales_tier, visit_price, visits_per_year, started_at, payment_setup_completed_at, stripe_customer_id, stripe_payment_method_id, agreement_id",
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

  const [
    homeownersRes,
    propertiesRes,
    obligationsRes,
    chargesRes,
    agreementsRes,
  ] = await Promise.all([
    supabase
      .from("homeowners")
      .select("id, full_name")
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
        "membership_id, service_month, status, charged_at, amount, amount_collected",
      )
      .in("membership_id", membershipIds)
      .order("service_month", { ascending: false }),
    agreementIds.length > 0
      ? supabase
          .from("signed_agreements")
          .select("id, agreement_pdf_url")
          .in("id", agreementIds)
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

  const allCharges: ChargeBillingRow[] = chargesAvailable
    ? ((chargesRes.data ?? []) as ChargeBillingRow[])
    : [];

  const referenceDate = new Date();
  const referenceYm = referenceDate.toISOString().slice(0, 7);

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
    const billingPeriod = resolveNextChargeDate(
      obligationInputs,
      referenceDate,
      paidServiceMonths,
    );
    const nextChargeDate = billingPeriod;
    const lastChargeDate = resolveLastChargeDate(chargeInputs);
    const paymentOnFile = hasPaymentMethodOnFile(membership);
    const membershipActive = isMembershipActive(membership);

    const serviceMonthKey = billingPeriod
      ? `${billingPeriod.slice(0, 7)}-01`
      : null;
    const periodCharge = serviceMonthKey
      ? charges.find((row) =>
          row.service_month.startsWith(serviceMonthKey.slice(0, 7)),
        )
      : null;
    const periodAlreadyPaid = periodCharge
      ? isPaidBillingStatus(periodCharge.status)
      : false;
    const latestChargeForMonth = periodCharge?.status ?? null;

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

    const chargedThisMonth = charges.find((row) => {
      if (!isPaidBillingStatus(row.status)) return false;
      const chargedYm =
        row.charged_at?.slice(0, 7) ?? row.service_month.slice(0, 7);
      return chargedYm === referenceYm;
    });
    if (chargedThisMonth) {
      billingStatus = "charged";
    }

    const cardOnFileLabel = paymentOnFile
      ? await resolvePortalPaymentMethodLabel(membership.stripe_payment_method_id)
      : null;

    const agreement = membership.agreement_id
      ? agreementById.get(membership.agreement_id)
      : null;
    const agreementPdfUrl = agreement?.agreement_pdf_url
      ? await resolveAgreementPdfAccessUrl(agreement.agreement_pdf_url)
      : null;

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
      stripePaymentStatus: resolveStripePaymentStatus(membership),
      cardOnFileLabel,
      stripeCustomerId: membership.stripe_customer_id,
      nextChargeDate,
      lastChargeDate,
      billingPeriod,
      periodAlreadyPaid,
      canRecordCharge:
        membershipActive &&
        paymentOnFile &&
        !periodAlreadyPaid &&
        (billingStatus === "ready_to_charge" || billingStatus === "failed"),
      billingStatus,
      agreementId: membership.agreement_id,
      agreementPdfUrl,
      chargeAction: "manual_charge",
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
