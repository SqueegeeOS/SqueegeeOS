import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";

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
    if (presentation.membership_id) {
      const { data: membership } = await supabase
        .from("memberships")
        .select("id, status, agreement_id, payment_setup_completed_at")
        .eq("id", presentation.membership_id)
        .maybeSingle();

      membershipStatus = membership?.status ?? null;
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
      onboardingIncomplete:
        presentation.onboarding_status === "pending_payment" ||
        membershipStatus === "pending_payment",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load onboarding status";
    console.error("[onboarding-status] error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
