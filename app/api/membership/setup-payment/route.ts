import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";

/**
 * Mock payment activation — marks membership active without Stripe or raw card data.
 * Stripe-ready: sets payment_setup_completed_at; stripe_payment_method_id stays null until Stripe.
 */
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 503 },
    );
  }

  try {
    const body = await req.json();
    const presentationId =
      typeof body.presentationId === "string" ? body.presentationId : null;
    const membershipId =
      typeof body.membershipId === "string" ? body.membershipId : null;

    if (!presentationId && !membershipId) {
      return NextResponse.json(
        { error: "presentationId or membershipId is required" },
        { status: 400 },
      );
    }

    const supabase = createServerSupabaseClient();

    let membershipQuery = supabase.from("memberships").select("*");
    if (membershipId) {
      membershipQuery = membershipQuery.eq("id", membershipId);
    } else if (presentationId) {
      membershipQuery = membershipQuery.eq("presentation_id", presentationId);
    }

    const { data: membership, error: membershipError } =
      await membershipQuery.maybeSingle();

    if (membershipError) {
      return NextResponse.json(
        { error: membershipError.message },
        { status: 500 },
      );
    }

    if (!membership) {
      return NextResponse.json(
        { error: "Membership not found for this presentation" },
        { status: 404 },
      );
    }

    if (membership.status === "active" && membership.payment_setup_completed_at) {
      return NextResponse.json({
        membershipId: membership.id,
        presentationId: membership.presentation_id,
        status: "active",
        onboardingStatus: "complete",
        alreadyActive: true,
      });
    }

    const now = new Date().toISOString();

    const { error: updateMembershipError } = await supabase
      .from("memberships")
      .update({
        status: "active",
        payment_setup_completed_at: now,
        started_at: membership.started_at ?? now,
      })
      .eq("id", membership.id);

    if (updateMembershipError) {
      return NextResponse.json(
        { error: updateMembershipError.message },
        { status: 500 },
      );
    }

    const resolvedPresentationId =
      presentationId ?? (membership.presentation_id as string | null);

    if (resolvedPresentationId) {
      const { error: presentationError } = await supabase
        .from("presentations")
        .update({ onboarding_status: "complete" })
        .eq("id", resolvedPresentationId);

      if (presentationError) {
        console.error(
          "[setup-payment] Presentation update failed:",
          presentationError.message,
        );
      }
    }

    return NextResponse.json({
      membershipId: membership.id,
      presentationId: resolvedPresentationId,
      status: "active",
      onboardingStatus: "complete",
      paymentSetupCompletedAt: now,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to set up payment";
    console.error("[setup-payment] error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
