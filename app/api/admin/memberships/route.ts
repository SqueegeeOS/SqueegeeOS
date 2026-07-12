import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/pin";
import { computeMembershipYearlyValue } from "@/lib/admin/compute-membership-yearly-value";
import {
  parseTimeWindowFromNotes,
} from "@/lib/admin/schedule-membership-service";
import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import { createServerSupabaseClient } from "@/lib/persistence/supabase/client";
import { isMissingColumnError } from "@/lib/persistence/queries/load-membership-portal-row";
import { MEMBER_ADDON_REVENUE_STATUSES } from "@/lib/persistence/types/member-addon";
import {
  hasPaymentMethodOnFile,
  isMembershipCancelled,
  resolveHqMembershipDisplayStatus,
  resolveMembershipLifecycle,
  type HqMembershipDisplayStatus,
  type MembershipLifecycleState,
} from "@/lib/membership/membership-status";
import {
  AUTHORITATIVE_APPOINTMENT_MATCH_STATE,
  AUTHORITATIVE_APPOINTMENT_PROVENANCE_STATES,
  AUTHORITATIVE_APPOINTMENT_PROVIDER,
  AUTHORITATIVE_APPOINTMENT_VERIFICATION_STATE,
} from "@/lib/care-operations/model";

export interface HqMembershipRow {
  id: string;
  customerName: string;
  address: string;
  planLabel: string;
  tier: "biannual" | "quarterly" | "unknown";
  status: HqMembershipDisplayStatus;
  lifecycleState: MembershipLifecycleState;
  rawStatus: string;
  visitPrice: number | null;
  visitsPerYear: number | null;
  yearlyValue: number | null;
  cardOnFile: boolean;
  stripeCustomer: boolean;
  nextServiceMonth: string | null;
  nextServiceDate: string | null;
  nextServiceTimeWindow: string | null;
  portalPath: string | null;
  agreementId: string | null;
  founding: boolean;
  lifetimeAddonRevenue: number | null;
  lifetimeAddonSavings: number | null;
  addonServiceCount: number;
  lifetimeMemberSavings: number | null;
}

interface UpcomingAppointmentRow {
  property_id: string;
  scheduled_at: string;
  notes: string | null;
}

interface MembershipQueryRow {
  id: string;
  homeowner_id: string;
  property_id: string;
  sales_tier: string | null;
  visit_price: number | null;
  annual_rate: number | null;
  visits_per_year: number | null;
  status: string;
  payment_setup_completed_at: string | null;
  stripe_customer_id: string | null;
  stripe_payment_method_id: string | null;
  next_billing_date: string | null;
  portal_access_token: string | null;
  agreement_id: string | null;
  founding_member: boolean | null;
  created_at: string;
}

const MEMBERSHIP_BASE_SELECT =
  "id, homeowner_id, property_id, sales_tier, visit_price, annual_rate, visits_per_year, status, payment_setup_completed_at, stripe_customer_id, stripe_payment_method_id, agreement_id, created_at";

const MEMBERSHIP_EXTENDED_SELECT = `${MEMBERSHIP_BASE_SELECT}, next_billing_date, portal_access_token, founding_member`;

interface AddonAggregateRow {
  membership_id: string;
  amount_charged_cents: number;
  saved_cents: number;
}

function isMissingTableError(message: string, table: string): boolean {
  return message.includes("does not exist") && message.includes(table);
}

async function loadAddonAggregatesByMembership(
  membershipIds: string[],
): Promise<Map<string, { revenue: number; savings: number; count: number }>> {
  const totals = new Map<string, { revenue: number; savings: number; count: number }>();
  if (membershipIds.length === 0) {
    return totals;
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("member_addon_transactions")
    .select("membership_id, amount_charged_cents, saved_cents")
    .in("membership_id", membershipIds)
    .in("status", MEMBER_ADDON_REVENUE_STATUSES);

  if (error) {
    if (isMissingTableError(error.message, "member_addon_transactions")) {
      return totals;
    }
    throw new Error(error.message);
  }

  for (const row of (data ?? []) as AddonAggregateRow[]) {
    const membershipId = row.membership_id;
    const current = totals.get(membershipId) ?? {
      revenue: 0,
      savings: 0,
      count: 0,
    };
    current.revenue += Number(row.amount_charged_cents ?? 0) / 100;
    current.savings += Number(row.saved_cents ?? 0) / 100;
    current.count += 1;
    totals.set(membershipId, current);
  }

  return totals;
}

interface LedgerAggregateRow {
  membership_id: string;
  amount_cents: number;
}

async function loadLedgerSavingsByMembership(
  membershipIds: string[],
): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  if (membershipIds.length === 0) {
    return totals;
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("member_savings_ledger_entries")
    .select("membership_id, amount_cents")
    .in("membership_id", membershipIds);

  if (error) {
    if (isMissingTableError(error.message, "member_savings_ledger_entries")) {
      return totals;
    }
    throw new Error(error.message);
  }

  for (const row of (data ?? []) as LedgerAggregateRow[]) {
    const membershipId = row.membership_id;
    totals.set(
      membershipId,
      (totals.get(membershipId) ?? 0) + Number(row.amount_cents ?? 0) / 100,
    );
  }

  return totals;
}

async function loadMembershipRows(): Promise<MembershipQueryRow[]> {
  const supabase = createServerSupabaseClient();

  const extended = await supabase
    .from("memberships")
    .select(MEMBERSHIP_EXTENDED_SELECT)
    .order("created_at", { ascending: true });

  if (!extended.error) {
    return (extended.data ?? []) as MembershipQueryRow[];
  }

  if (
    isMissingColumnError(extended.error.message, "next_billing_date") ||
    isMissingColumnError(extended.error.message, "portal_access_token") ||
    isMissingColumnError(extended.error.message, "founding_member")
  ) {
    const base = await supabase
      .from("memberships")
      .select(MEMBERSHIP_BASE_SELECT)
      .order("created_at", { ascending: true });

    if (base.error) {
      throw new Error(base.error.message);
    }

    return ((base.data ?? []) as Omit<
      MembershipQueryRow,
      "next_billing_date" | "portal_access_token" | "founding_member"
    >[]).map((row) => ({
      ...row,
      next_billing_date: null,
      portal_access_token: null,
      founding_member: false,
    }));
  }

  throw new Error(extended.error.message);
}

export async function GET(request: Request) {
  const pinHeader = request.headers.get("x-admin-pin");
  if (!authorizeAdminRequest(pinHeader)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isCloudPersistenceConnected()) {
    return NextResponse.json({ rows: [], connected: false });
  }

  try {
    const rows = await loadMembershipRows();
    const homeownerIds = [...new Set(rows.map((m) => m.homeowner_id).filter(Boolean))];
    const propertyIds = [...new Set(rows.map((m) => m.property_id).filter(Boolean))];

    const supabase = createServerSupabaseClient();
    const [homeowners, properties] = await Promise.all([
      homeownerIds.length
        ? supabase.from("homeowners").select("id, full_name").in("id", homeownerIds)
        : Promise.resolve({ data: [] as Array<{ id: string; full_name: string }>, error: null }),
      propertyIds.length
        ? supabase.from("properties").select("id, address, city").in("id", propertyIds)
        : Promise.resolve({ data: [] as Array<{ id: string; address: string; city: string }>, error: null }),
    ]);

    if (homeowners.error) {
      throw new Error(homeowners.error.message);
    }
    if (properties.error) {
      throw new Error(properties.error.message);
    }

    const nowIso = new Date().toISOString();
    const { data: appointmentRows, error: appointmentError } =
      propertyIds.length > 0
        ? await supabase
            .from("member_appointments")
            .select("property_id, scheduled_at, notes")
            .in("property_id", propertyIds)
            .eq("provider", AUTHORITATIVE_APPOINTMENT_PROVIDER)
            .in("provenance_state", [...AUTHORITATIVE_APPOINTMENT_PROVENANCE_STATES])
            .eq("verification_state", AUTHORITATIVE_APPOINTMENT_VERIFICATION_STATE)
            .eq("match_state", AUTHORITATIVE_APPOINTMENT_MATCH_STATE)
            .eq("status", "scheduled")
            .gte("scheduled_at", nowIso)
            .order("scheduled_at", { ascending: true })
        : { data: [], error: null };

    if (appointmentError) {
      throw new Error(appointmentError.message);
    }

    const nextAppointmentByProperty = new Map<string, UpcomingAppointmentRow>();
    for (const row of (appointmentRows ?? []) as UpcomingAppointmentRow[]) {
      if (!nextAppointmentByProperty.has(row.property_id)) {
        nextAppointmentByProperty.set(row.property_id, row);
      }
    }

    const nameById = new Map(
      (homeowners.data ?? []).map((h) => [h.id as string, (h.full_name as string) || ""]),
    );
    const addrById = new Map(
      (properties.data ?? []).map((p) => [
        p.id as string,
        [p.address, p.city].filter(Boolean).join(", "),
      ]),
    );

    const addonTotalsByMembership = await loadAddonAggregatesByMembership(
      rows.map((row) => row.id),
    );
    const ledgerSavingsByMembership = await loadLedgerSavingsByMembership(
      rows.map((row) => row.id),
    );

    const out: HqMembershipRow[] = rows.map((m) => {
      const upcoming = nextAppointmentByProperty.get(m.property_id) ?? null;
      const nextScheduledAt = upcoming?.scheduled_at ?? null;
      const nextServiceTimeWindow = parseTimeWindowFromNotes(
        upcoming?.notes ?? null,
      );
      const nextServiceDate = nextScheduledAt?.slice(0, 10) ?? null;
      const nextServiceMonth =
        nextServiceDate?.slice(0, 7) ?? m.next_billing_date?.slice(0, 7) ?? null;

      const yearly = computeMembershipYearlyValue(m);
      const addonTotals = addonTotalsByMembership.get(m.id);
      const ledgerSavings = ledgerSavingsByMembership.get(m.id);
      const lifetimeMemberSavings =
        ledgerSavings != null && ledgerSavings > 0
          ? ledgerSavings
          : addonTotals && addonTotals.savings > 0
            ? addonTotals.savings
            : 0;
      const lifecycleInput = {
        status: m.status,
        payment_setup_completed_at: m.payment_setup_completed_at,
        stripe_payment_method_id: m.stripe_payment_method_id,
        stripe_customer_id: m.stripe_customer_id,
        agreement_id: m.agreement_id,
        sales_tier: m.sales_tier,
        visit_price: m.visit_price,
        visits_per_year: m.visits_per_year,
        nextScheduledAt,
      };
      const lifecycle = resolveMembershipLifecycle(lifecycleInput);

      return {
        id: m.id,
        customerName: nameById.get(m.homeowner_id) || "Unknown",
        address: addrById.get(m.property_id) || "Unknown",
        planLabel:
          m.sales_tier === "biannual"
            ? "Bi-Annual"
            : m.sales_tier === "quarterly"
              ? "Quarterly"
              : "Unknown",
        tier: (m.sales_tier as HqMembershipRow["tier"]) ?? "unknown",
        status: resolveHqMembershipDisplayStatus(lifecycleInput),
        lifecycleState: lifecycle.state,
        rawStatus: m.status,
        visitPrice: m.visit_price,
        visitsPerYear: m.visits_per_year,
        yearlyValue: yearly,
        cardOnFile: Boolean(m.stripe_payment_method_id),
        stripeCustomer: Boolean(m.stripe_customer_id),
        nextServiceMonth,
        nextServiceDate,
        nextServiceTimeWindow,
        portalPath: m.portal_access_token ? `/portal/${m.portal_access_token}` : null,
        agreementId: m.agreement_id,
        founding: Boolean(m.founding_member),
        lifetimeAddonRevenue: addonTotals ? addonTotals.revenue : 0,
        lifetimeAddonSavings: addonTotals ? addonTotals.savings : 0,
        addonServiceCount: addonTotals?.count ?? 0,
        lifetimeMemberSavings,
      };
    });

    const totalAddonRevenue = out.reduce(
      (sum, row) => sum + (row.lifetimeAddonRevenue ?? 0),
      0,
    );

    return NextResponse.json({ rows: out, connected: true, totalAddonRevenue });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load memberships";
    console.error("[memberships] load failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
