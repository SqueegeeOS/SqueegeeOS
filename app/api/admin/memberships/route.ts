import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/pin";
import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import { createServerSupabaseClient } from "@/lib/persistence/supabase/client";

export interface HqMembershipRow {
  id: string;
  customerName: string;
  address: string;
  planLabel: string;
  tier: "biannual" | "quarterly" | "unknown";
  status: "active" | "needs card" | "needs scheduling" | "signed" | "attention" | "cancelled";
  rawStatus: string;
  visitPrice: number | null;
  visitsPerYear: number | null;
  yearlyValue: number | null;
  cardOnFile: boolean;
  stripeCustomer: boolean;
  nextServiceMonth: string | null;
  portalPath: string | null;
  agreementId: string | null;
  founding: boolean;
}

function deriveStatus(m: {
  status: string;
  stripe_payment_method_id: string | null;
  payment_setup_completed_at: string | null;
  next_billing_date: string | null;
}): HqMembershipRow["status"] {
  if (m.status === "cancelled" || m.status === "paused") return "cancelled";
  const paid = Boolean(m.payment_setup_completed_at || m.stripe_payment_method_id);
  if (m.status === "active" && paid) {
    return m.next_billing_date ? "active" : "needs scheduling";
  }
  if (!paid) return "needs card";
  if (m.status === "pending_payment") return "signed";
  return "attention";
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
    const supabase = createServerSupabaseClient();
    const { data: memberships, error } = await supabase
      .from("memberships")
      .select(
        "id, homeowner_id, property_id, sales_tier, visit_price, annual_rate, visits_per_year, status, billing_schedule, payment_setup_completed_at, stripe_customer_id, stripe_payment_method_id, next_billing_date, portal_access_token, agreement_id, founding_member, created_at",
      )
      .order("created_at", { ascending: true });
    if (error) throw error;

    const rows = memberships ?? [];
    const homeownerIds = [...new Set(rows.map((m) => m.homeowner_id).filter(Boolean))];
    const propertyIds = [...new Set(rows.map((m) => m.property_id).filter(Boolean))];

    const [homeowners, properties] = await Promise.all([
      homeownerIds.length
        ? supabase.from("homeowners").select("id, full_name").in("id", homeownerIds)
        : Promise.resolve({ data: [] as Array<{ id: string; full_name: string }> }),
      propertyIds.length
        ? supabase.from("properties").select("id, address, city").in("id", propertyIds)
        : Promise.resolve({ data: [] as Array<{ id: string; address: string; city: string }> }),
    ]);

    const nameById = new Map(
      (homeowners.data ?? []).map((h) => [h.id as string, (h.full_name as string) || ""]),
    );
    const addrById = new Map(
      (properties.data ?? []).map((p) => [
        p.id as string,
        [p.address, p.city].filter(Boolean).join(", "),
      ]),
    );

    const out: HqMembershipRow[] = rows.map((m) => {
      const yearly =
        typeof m.annual_rate === "number"
          ? m.annual_rate
          : typeof m.visit_price === "number" && typeof m.visits_per_year === "number"
            ? m.visit_price * m.visits_per_year
            : null;
      return {
        id: m.id as string,
        customerName: nameById.get(m.homeowner_id as string) || "Unknown",
        address: addrById.get(m.property_id as string) || "Unknown",
        planLabel:
          m.sales_tier === "biannual"
            ? "Bi-Annual"
            : m.sales_tier === "quarterly"
              ? "Quarterly"
              : "Unknown",
        tier: (m.sales_tier as HqMembershipRow["tier"]) ?? "unknown",
        status: deriveStatus(m),
        rawStatus: m.status as string,
        visitPrice: m.visit_price as number | null,
        visitsPerYear: m.visits_per_year as number | null,
        yearlyValue: yearly,
        cardOnFile: Boolean(m.stripe_payment_method_id),
        stripeCustomer: Boolean(m.stripe_customer_id),
        nextServiceMonth: m.next_billing_date as string | null,
        portalPath: m.portal_access_token ? `/portal/${m.portal_access_token}` : null,
        agreementId: m.agreement_id as string | null,
        founding: Boolean(m.founding_member),
      };
    });

    return NextResponse.json({ rows: out, connected: true });
  } catch {
    return NextResponse.json({ error: "Failed to load memberships" }, { status: 500 });
  }
}
