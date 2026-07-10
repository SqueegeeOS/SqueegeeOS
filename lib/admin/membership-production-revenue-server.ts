import {
  createServerSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";
import { MEMBER_ADDON_REVENUE_STATUSES } from "@/lib/persistence/types/member-addon";
import {
  hasPaymentMethodOnFile,
  isMembershipActive,
  isMembershipCancelled,
} from "@/lib/membership/membership-status";
import { computeMembershipYearlyValue } from "./compute-membership-yearly-value";
import { getBusinessCalendarDayUtcBounds } from "./company-business-timezone";
import type { MembershipProductionRevenueOverview } from "./membership-production-revenue-types";
import type { MembershipProductionSigning } from "./membership-production-revenue-types";

const EMPTY_OVERVIEW: MembershipProductionRevenueOverview = {
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
};

interface MembershipRow {
  id: string;
  homeowner_id: string;
  property_id: string;
  agreement_id: string | null;
  sales_tier: string | null;
  visit_price: number | null;
  annual_rate: number | null;
  visits_per_year: number | null;
  status: string;
  payment_setup_completed_at: string | null;
  stripe_payment_method_id: string | null;
}

interface AgreementRow {
  id: string;
  signed_at: string;
  homeowner_name: string;
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function isOnBook(row: MembershipRow): boolean {
  return !isMembershipCancelled(row) && Boolean(row.agreement_id);
}

function isMissingTableError(message: string, table: string): boolean {
  return message.includes("does not exist") && message.includes(table);
}

export async function loadMembershipProductionRevenueOverview(): Promise<MembershipProductionRevenueOverview> {
  if (!isSupabaseConfigured()) {
    return EMPTY_OVERVIEW;
  }

  try {
    const supabase = createServerSupabaseClient();
    const { data: membershipData, error: membershipError } = await supabase
      .from("memberships")
      .select(
        "id, homeowner_id, property_id, agreement_id, sales_tier, visit_price, annual_rate, visits_per_year, status, payment_setup_completed_at, stripe_payment_method_id",
      )
      .order("created_at", { ascending: true });

    if (membershipError) {
      throw membershipError;
    }

    const memberships = (membershipData ?? []) as MembershipRow[];
    const onBook = memberships.filter(isOnBook);
    const agreementIds = [
      ...new Set(
        onBook
          .map((row) => row.agreement_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const [agreementsRes, addonRes, homeownersRes, propertiesRes] =
      await Promise.all([
        agreementIds.length
          ? supabase
              .from("signed_agreements")
              .select("id, signed_at, homeowner_name")
              .in("id", agreementIds)
          : Promise.resolve({ data: [] as AgreementRow[], error: null }),
        supabase
          .from("member_addon_transactions")
          .select("amount_charged_cents")
          .in("status", MEMBER_ADDON_REVENUE_STATUSES),
        supabase.from("homeowners").select("id, full_name"),
        supabase.from("properties").select("id, address, city"),
      ]);

    if (agreementsRes.error) {
      throw agreementsRes.error;
    }
    if (addonRes.error && !isMissingTableError(addonRes.error.message, "member_addon_transactions")) {
      throw addonRes.error;
    }

    const agreementById = new Map(
      ((agreementsRes.data ?? []) as AgreementRow[]).map((row) => [row.id, row]),
    );
    const nameByHomeownerId = new Map(
      (homeownersRes.data ?? []).map((row) => [
        row.id as string,
        (row.full_name as string) || "",
      ]),
    );
    const addressByPropertyId = new Map(
      (propertiesRes.data ?? []).map((row) => [
        row.id as string,
        [row.address, row.city].filter(Boolean).join(", "),
      ]),
    );

    const now = new Date();
    const { startUtc: businessDayStart, endUtc: businessDayEnd } =
      getBusinessCalendarDayUtcBounds(now);
    const monthStart = startOfUtcMonth(now).toISOString();

    let membersSignedToday = 0;
    let membersSignedThisMonth = 0;
    let cardOnFileCount = 0;
    let activeMembershipValue = 0;
    let expectedYearlyMembershipRevenue = 0;

    const recentSignings: MembershipProductionSigning[] = onBook
      .map((row) => {
        const agreement = row.agreement_id
          ? agreementById.get(row.agreement_id)
          : undefined;
        const signedAt = agreement?.signed_at ?? null;
        const yearlyValue = computeMembershipYearlyValue(row);
        const cardOnFile = hasPaymentMethodOnFile(row);
        const membershipActive = isMembershipActive(row);
        const tier: MembershipProductionSigning["tier"] =
          row.sales_tier === "biannual" || row.sales_tier === "quarterly"
            ? row.sales_tier
            : "unknown";

        if (signedAt) {
          const signedInstant = new Date(signedAt);
          if (
            signedInstant >= businessDayStart &&
            signedInstant < businessDayEnd
          ) {
            membersSignedToday += 1;
          }
        }
        if (signedAt && signedAt >= monthStart) {
          membersSignedThisMonth += 1;
        }
        if (cardOnFile) {
          cardOnFileCount += 1;
        }
        if (membershipActive) {
          activeMembershipValue += yearlyValue ?? 0;
        }
        expectedYearlyMembershipRevenue += yearlyValue ?? 0;

        return {
          membershipId: row.id,
          propertyId: row.property_id,
          customerName:
            agreement?.homeowner_name ||
            nameByHomeownerId.get(row.homeowner_id) ||
            "Unknown",
          propertyAddress: addressByPropertyId.get(row.property_id) || "Unknown",
          tier,
          visitPrice: row.visit_price,
          yearlyValue,
          signedAt: signedAt ?? "",
          cardOnFile,
        };
      })
      .filter((row) => row.signedAt)
      .sort((a, b) => b.signedAt.localeCompare(a.signedAt))
      .slice(0, 20);

    const addonRevenueCollected = (addonRes.data ?? []).reduce(
      (sum, row) => sum + Number(row.amount_charged_cents ?? 0) / 100,
      0,
    );

    return {
      membersSignedToday,
      membersSignedThisMonth,
      cardOnFileCount,
      membersOnBook: onBook.length,
      activeMembershipValue,
      expectedYearlyMembershipRevenue,
      addonRevenueCollected,
      totalCustomerRevenue:
        expectedYearlyMembershipRevenue + addonRevenueCollected,
      recentSignings,
      source: "supabase",
    };
  } catch (error) {
    console.error("[membership-production-revenue] overview load failed:", error);
    return EMPTY_OVERVIEW;
  }
}
