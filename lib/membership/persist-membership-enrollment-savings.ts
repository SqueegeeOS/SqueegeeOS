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
  const full = await supabase
    .from("memberships")
    .select("membership_enrollment_savings, sales_tier, presentation_id")
    .eq("id", membershipId)
    .maybeSingle();

  let membership = full.data;
  if (full.error) {
    if (
      !(
        full.error.message.includes("does not exist") &&
        full.error.message.includes("membership_enrollment_savings")
      )
    ) {
      throw new Error(full.error.message);
    }

    const base = await supabase
      .from("memberships")
      .select("sales_tier, presentation_id")
      .eq("id", membershipId)
      .maybeSingle();
    if (base.error) throw new Error(base.error.message);
    membership = base.data
      ? { ...base.data, membership_enrollment_savings: null }
      : null;
  }

  if (!membership) {
    return;
  }

  return persistMembershipEnrollmentSavingsWithRow(
    supabase,
    membershipId,
    presentationId,
    membership,
  );
}

async function persistMembershipEnrollmentSavingsWithRow(
  supabase: SupabaseClient,
  membershipId: string,
  presentationId: string | null,
  membership: {
    membership_enrollment_savings?: number | null;
    sales_tier: string | null;
    presentation_id: string | null;
  },
): Promise<void> {
  if (membership.membership_enrollment_savings != null) {
    return;
  }

  const resolvedPresentationId =
    presentationId ?? (membership.presentation_id as string | null);

  let enrollmentSavings: number | null = null;

  if (resolvedPresentationId) {
    const { data: presentation, error: presentationError } = await supabase
      .from("presentations")
      .select("enrollment_savings, tier")
      .eq("id", resolvedPresentationId)
      .maybeSingle();

    if (
      presentationError &&
      !(
        presentationError.message.includes("does not exist") &&
        presentationError.message.includes("enrollment_savings")
      )
    ) {
      throw new Error(presentationError.message);
    }

    if (presentation) {
      enrollmentSavings = resolveEnrollmentSavings(
        presentation.enrollment_savings != null
          ? Number(presentation.enrollment_savings)
          : null,
        (presentation.tier as string) ?? "quarterly",
      );
    } else if (presentationError) {
      const { data: presentationBase } = await supabase
        .from("presentations")
        .select("tier")
        .eq("id", resolvedPresentationId)
        .maybeSingle();
      if (presentationBase) {
        enrollmentSavings = resolveEnrollmentSavings(
          null,
          (presentationBase.tier as string) ?? "quarterly",
        );
      }
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
