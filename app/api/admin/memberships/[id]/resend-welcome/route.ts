import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import { loadMembershipForPayment } from "@/lib/membership/load-membership-for-payment";
import { isMembershipActive } from "@/lib/membership/membership-status";
import { sendMembershipWelcomeEmail } from "@/lib/membership/send-membership-welcome-email";
import {
  createPrivilegedServerSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!authorizeAdminRequest(request.headers)) {
    return unauthorized();
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 503 },
    );
  }

  const { id } = await context.params;
  if (!id.trim()) {
    return NextResponse.json(
      { error: "Membership ID is required" },
      { status: 400 },
    );
  }

  try {
    const supabase = createPrivilegedServerSupabaseClient();
    const membership = await loadMembershipForPayment(supabase, {
      membershipId: id,
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Membership not found" },
        { status: 404 },
      );
    }

    if (!isMembershipActive(membership)) {
      return NextResponse.json(
        { error: "Welcome email is only available for active members" },
        { status: 409 },
      );
    }

    const result = await sendMembershipWelcomeEmail(supabase, {
      membershipId: membership.id,
      homeownerId: membership.homeowner_id,
      presentationId: membership.presentation_id,
      idempotencyKey: `membership-welcome-manual-${membership.id}-${randomUUID()}`,
    });

    if (result.status === "sent") {
      return NextResponse.json({
        status: "sent",
        message: "Welcome email accepted by the email provider.",
      });
    }

    const error =
      result.reason === "no_valid_recipient_email"
        ? "This member does not have a valid email address."
        : result.reason === "missing_portal_access"
          ? "This membership does not have a portal access link."
          : "The welcome email could not be sent. Try again in a moment.";
    const status = result.status === "skipped" ? 422 : 502;

    console.warn("[memberships/resend-welcome] not sent", {
      membershipId: membership.id,
      status: result.status,
      reason: result.reason,
    });
    return NextResponse.json({ error, status: result.status }, { status });
  } catch (error) {
    console.error("[memberships/resend-welcome] failed", {
      membershipId: id,
      error,
    });
    return NextResponse.json(
      { error: "The welcome email could not be sent. Try again in a moment." },
      { status: 500 },
    );
  }
}
