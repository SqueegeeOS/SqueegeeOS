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

function maskRecipient(email: string | null | undefined): string | null {
  const normalized = email?.trim();
  if (!normalized) return null;
  const [local, domain] = normalized.split("@");
  if (!local || !domain) return null;
  return `${local.slice(0, 1)}***@${domain}`;
}

async function recordWelcomeAttempt(
  supabase: SupabaseClient,
  input: SendMembershipWelcomeEmailInput,
  result: AgreementEmailResult,
): Promise<void> {
  const idempotencyKey =
    input.idempotencyKey ??
    `membership-welcome-${input.membershipId}-${result.resendId ?? Date.now()}`;
  const status =
    result.status === "sent"
      ? "accepted"
      : result.status === "skipped"
        ? "skipped"
        : "failed";
  const now = new Date().toISOString();
  const { error } = await supabase.from("membership_communications").upsert(
    {
      membership_id: input.membershipId,
      communication_type: "welcome_email",
      channel: "email",
      provider: "resend",
      provider_message_id: result.resendId ?? null,
      idempotency_key: idempotencyKey,
      destination_masked: maskRecipient(result.recipient),
      status,
      reason: result.reason ?? null,
      sent_at: result.status === "sent" ? now : null,
    },
    { onConflict: "idempotency_key" },
  );
  if (error) {
    const missingTable =
      error.code === "42P01" ||
      error.code === "PGRST205" ||
      error.message.toLowerCase().includes("does not exist") ||
      error.message.toLowerCase().includes("schema cache");
    console.warn("[membership-welcome] delivery ledger write failed", {
      membershipId: input.membershipId,
      reason: missingTable ? "migration_036_required" : error.message,
    });
  }
}

export async function sendMembershipWelcomeEmail(
  supabase: SupabaseClient,
  input: SendMembershipWelcomeEmailInput,
): Promise<AgreementEmailResult> {
  const portalUrl =
    input.portalUrl ??
    (await getPortalAccessUrlForMembership(input.membershipId, input.origin));

  if (!portalUrl) {
    const result: AgreementEmailResult = {
      status: "skipped",
      reason: "missing_portal_access",
      recipient: null,
    };
    await recordWelcomeAttempt(supabase, input, result);
    return result;
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
    const result: AgreementEmailResult = {
      status: "failed",
      reason: "recipient_lookup_failed",
      recipient: null,
    };
    await recordWelcomeAttempt(supabase, input, result);
    return result;
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
    const result: AgreementEmailResult = {
      status: "skipped",
      reason: "no_valid_recipient_email",
      recipient: null,
    };
    await recordWelcomeAttempt(supabase, input, result);
    return result;
  }

  const result = await sendWelcomeEmail({
    to: memberEmail,
    name: memberName,
    portalUrl,
    idempotencyKey: input.idempotencyKey,
  });
  await recordWelcomeAttempt(supabase, input, result);
  return result;
}
