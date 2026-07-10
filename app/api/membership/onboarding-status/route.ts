import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";
import {
  resolveMembershipLifecycle,
  type MembershipLifecycleState,
} from "@/lib/membership/membership-status";
import { getPortalAccessUrlForMembership } from "@/lib/persistence/queries/portal-access";

export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 503 },
    );
  }

  const presentationId = req.nextUrl.searchParams.get("presentationId");
  if (!presentationId) {
    return NextResponse.json(
      { error: "presentationId is required" },
      { status: 400 },
    );
  }

  try {
    const supabase = createServerSupabaseClient();

    const { data: presentation, error: presentationError } = await supabase
      .from("presentations")
      .select(
        "id, status, signed_at, agreement_id, membership_id, homeowner_id, property_id, onboarding_status",
      )
      .eq("id", presentationId)
      .maybeSingle();

    if (presentationError) {
      return NextResponse.json(
        { error: presentationError.message },
        { status: 500 },
      );
    }

    if (!presentation) {
      return NextResponse.json(
        { error: "Presentation not found" },
        { status: 404 },
      );
    }

    let membershipStatus: string | null = null;
    let lifecycleState: MembershipLifecycleState | null = null;
    let portalUrl: string | null = null;
    if (presentation.membership_id) {
      const { data: membership } = await supabase
        .from("memberships")
        .select(
          "id, status, agreement_id, payment_setup_completed_at, stripe_payment_method_id, stripe_customer_id, sales_tier, visit_price, visits_per_year",
        )
        .eq("id", presentation.membership_id)
        .maybeSingle();

      membershipStatus = membership?.status ?? null;
      if (membership) {
        lifecycleState = resolveMembershipLifecycle({
          status: membership.status as string,
          payment_setup_completed_at:
            (membership.payment_setup_completed_at as string | null) ?? null,
          stripe_payment_method_id:
            (membership.stripe_payment_method_id as string | null) ?? null,
          stripe_customer_id:
            (membership.stripe_customer_id as string | null) ?? null,
          agreement_id: (membership.agreement_id as string | null) ?? null,
          sales_tier: (membership.sales_tier as string | null) ?? null,
          visit_price:
            membership.visit_price != null
              ? Number(membership.visit_price)
              : null,
          visits_per_year:
            membership.visits_per_year != null
              ? Number(membership.visits_per_year)
              : null,
          presentationStatus: presentation.status as string,
          onboardingStatus: presentation.onboarding_status as string | null,
        }).state;
      }
      if (membership?.id) {
        portalUrl = await getPortalAccessUrlForMembership(
          membership.id,
          req.nextUrl.origin,
        );
      }
    }

    const signed =
      presentation.status === "signed" ||
      Boolean(presentation.signed_at && presentation.agreement_id);

    return NextResponse.json({
      presentationId: presentation.id,
      signed,
      agreementId: presentation.agreement_id,
      membershipId: presentation.membership_id,
      homeownerId: presentation.homeowner_id,
      propertyId: presentation.property_id,
      onboardingStatus: presentation.onboarding_status,
      membershipStatus,
      lifecycleState,
      onboardingIncomplete:
        lifecycleState === "payment_pending" ||
        lifecycleState === "activation_pending" ||
        lifecycleState === "agreement_pending",
      portalUrl,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load onboarding status";
    console.error("[onboarding-status] error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
