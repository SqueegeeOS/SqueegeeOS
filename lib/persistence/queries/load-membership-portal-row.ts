import type { SupabaseClient } from "@supabase/supabase-js";

import { isAtlasThemeId, type AtlasThemeId } from "@/lib/theme/atlas-themes";

export interface MembershipPortalRow {
  id: string;
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
  portal_theme: AtlasThemeId | null;
}

const MEMBERSHIP_PORTAL_BASE_SELECT =
  "id, plan_name, price_display, started_at, status, founding_member, founding_member_since, sales_tier, visit_price, visits_per_year, payment_setup_completed_at, presentation_id, stripe_payment_method_id, agreement_id";

const MEMBERSHIP_PORTAL_FULL_SELECT = `${MEMBERSHIP_PORTAL_BASE_SELECT}, membership_enrollment_savings, portal_theme`;

function isMissingColumnError(message: string, column: string): boolean {
  return message.includes(column) && message.includes("does not exist");
}

export { isMissingColumnError };

export async function loadMembershipPortalRow(
  supabase: SupabaseClient,
  propertyId: string,
): Promise<MembershipPortalRow | null> {
  const full = await supabase
    .from("memberships")
    .select(MEMBERSHIP_PORTAL_FULL_SELECT)
    .eq("property_id", propertyId)
    .maybeSingle();

  if (!full.error) {
    const row = full.data as MembershipPortalRow | null;
    if (!row) return null;
    return {
      ...row,
      portal_theme: isAtlasThemeId(row.portal_theme) ? row.portal_theme : null,
    };
  }

  const missingEnrollment = isMissingColumnError(
    full.error.message,
    "membership_enrollment_savings",
  );
  const missingTheme = isMissingColumnError(full.error.message, "portal_theme");

  if (!missingEnrollment && !missingTheme) {
    throw new Error(full.error.message);
  }

  const select = missingTheme
    ? `${MEMBERSHIP_PORTAL_BASE_SELECT}${missingEnrollment ? "" : ", membership_enrollment_savings"}`
    : `${MEMBERSHIP_PORTAL_BASE_SELECT}, membership_enrollment_savings`;

  const base = await supabase
    .from("memberships")
    .select(select)
    .eq("property_id", propertyId)
    .maybeSingle();

  if (base.error) {
    throw new Error(base.error.message);
  }

  if (!base.data) return null;

  const raw = base.data as unknown as Omit<
    MembershipPortalRow,
    "membership_enrollment_savings" | "portal_theme"
  > & {
    membership_enrollment_savings?: number | null;
    portal_theme?: string | null;
  };

  return {
    ...raw,
    membership_enrollment_savings: raw.membership_enrollment_savings ?? null,
    portal_theme: isAtlasThemeId(raw.portal_theme) ? raw.portal_theme : null,
  };
}
