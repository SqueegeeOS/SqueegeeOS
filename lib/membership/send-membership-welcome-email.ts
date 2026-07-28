import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgreementEmailResult } from "@/lib/agreement/agreement-email-types";
import { resolveMemberEmail } from "@/lib/agreement/resolve-member-email";
import { sendWelcomeEmail } from "@/lib/agreement/send-welcome-email";
import { getPortalAccessUrlForMembership } from "@/lib/persistence/queries/portal-access";

export interface SendMembershipWelcomeEmailInput {
  membershipId: string;
  homeownerId: string;
  presentationId: string | null;
  portalUrl?: string | null;
  origin?: string | null;
  idempotencyKey?: string;
}

export function buildInitialWelcomeIdempotencyKey(
  membershipId: string,
  paymentSetupCompletedAt: string,
): string {
  return `membership-welcome-${membershipId}-${paymentSetupCompletedAt.replace(/[^a-zA-Z0-9]/g, "")}`;
}

export async function sendMembershipWelcomeEmail(
  supabase: SupabaseClient,
  input: SendMembershipWelcomeEmailInput,
): Promise<AgreementEmailResult> {
  const portalUrl =
    input.portalUrl ??
    (await getPortalAccessUrlForMembership(input.membershipId, input.origin));

  if (!portalUrl) {
    return {
      status: "skipped",
      reason: "missing_portal_access",
      recipient: null,
    };
  }

  const [{ data: homeowner, error: homeownerError }, presentationResult] =
    await Promise.all([
      supabase
        .from("homeowners")
        .select("full_name, email")
        .eq("id", input.homeownerId)
        .maybeSingle(),
      input.presentationId
        ? supabase
            .from("presentations")
            .select("client_email, client_name")
            .eq("id", input.presentationId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

  if (homeownerError || presentationResult.error) {
    console.error("[membership-welcome] recipient lookup failed", {
      membershipId: input.membershipId,
      homeownerError: homeownerError?.message,
      presentationError: presentationResult.error?.message,
    });
    return {
      status: "failed",
      reason: "recipient_lookup_failed",
      recipient: null,
    };
  }

  const presentation = presentationResult.data;
  const memberEmail = resolveMemberEmail(
    presentation?.client_email as string | null | undefined,
    homeowner?.email as string | null | undefined,
  );
  const memberName =
    (presentation?.client_name as string | null | undefined)?.trim() ||
    (homeowner?.full_name as string | null | undefined)?.trim() ||
    "Member";

  if (!memberEmail) {
    return {
      status: "skipped",
      reason: "no_valid_recipient_email",
      recipient: null,
    };
  }

  return sendWelcomeEmail({
    to: memberEmail,
    name: memberName,
    portalUrl,
    idempotencyKey: input.idempotencyKey,
  });
}
