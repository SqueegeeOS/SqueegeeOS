import { resolveEnrollmentSavings } from "@/lib/membership/enrollment-savings";
import { normalizeToSqueegeeKingTier } from "@/lib/membership/tier-config";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Locks membership_enrollment_savings on first activation.
 * Value is copied from the presentation and never updated afterward.
 */
export async function persistMembershipEnrollmentSavings(
  supabase: SupabaseClient,
  membershipId: string,
  presentationId: string | null,
): Promise<void> {
  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("membership_enrollment_savings, sales_tier, presentation_id")
    .eq("id", membershipId)
    .maybeSingle();

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  if (!membership || membership.membership_enrollment_savings != null) {
    return;
  }

  const resolvedPresentationId =
    presentationId ?? (membership.presentation_id as string | null);

  let enrollmentSavings: number | null = null;

  if (resolvedPresentationId) {
    const { data: presentation } = await supabase
      .from("presentations")
      .select("enrollment_savings, tier")
      .eq("id", resolvedPresentationId)
      .maybeSingle();

    if (presentation) {
      enrollmentSavings = resolveEnrollmentSavings(
        presentation.enrollment_savings as number | null,
        (presentation.tier as string) ?? "quarterly",
      );
    }
  }

  if (enrollmentSavings == null && membership.sales_tier) {
    enrollmentSavings = resolveEnrollmentSavings(
      null,
      normalizeToSqueegeeKingTier(membership.sales_tier as string),
    );
  }

  if (enrollmentSavings == null) {
    return;
  }

  const { error: updateError } = await supabase
    .from("memberships")
    .update({ membership_enrollment_savings: enrollmentSavings })
    .eq("id", membershipId)
    .is("membership_enrollment_savings", null);

  if (updateError) {
    if (
      updateError.message.includes("membership_enrollment_savings") &&
      updateError.message.includes("does not exist")
    ) {
      console.warn(
        "[enrollment-savings] column missing — run migration 023",
      );
      return;
    }
    throw new Error(updateError.message);
  }
}
