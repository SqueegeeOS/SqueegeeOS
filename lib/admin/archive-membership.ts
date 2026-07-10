import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import { createServerSupabaseClient } from "@/lib/persistence/supabase/client";

export interface ArchiveMembershipInput {
  membershipId: string;
  reason?: string;
}

export interface ArchiveMembershipResult {
  membershipId: string;
  archivedAt: string;
  previousStatus: string;
  obligationsVoided: number;
}

interface MembershipArchiveRow {
  id: string;
  status: string;
  homeowner_id: string;
  property_id: string;
  agreement_id: string | null;
}

function validateMembershipId(membershipId: string): string | null {
  const trimmed = membershipId.trim();
  if (!trimmed) return "Membership ID is required";
  return null;
}

export function validateArchiveMembershipInput(
  input: ArchiveMembershipInput,
): string | null {
  return validateMembershipId(input.membershipId);
}

export async function archiveMembership(
  input: ArchiveMembershipInput,
): Promise<ArchiveMembershipResult> {
  if (!isCloudPersistenceConnected()) {
    throw new Error("Cloud persistence is not connected");
  }

  const validationError = validateArchiveMembershipInput(input);
  if (validationError) {
    throw new Error(validationError);
  }

  const supabase = createServerSupabaseClient();
  const membershipId = input.membershipId.trim();
  const reason =
    input.reason?.trim() ||
    "Membership archived from HQ command center";

  const { data: existing, error: fetchError } = await supabase
    .from("memberships")
    .select("id, status, homeowner_id, property_id, agreement_id")
    .eq("id", membershipId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  if (!existing) {
    throw new Error("Membership not found");
  }

  const row = existing as MembershipArchiveRow;

  if (row.status === "cancelled") {
    throw new Error("Membership is already archived");
  }

  const archivedAt = new Date().toISOString();

  const { data: updated, error: updateError } = await supabase
    .from("memberships")
    .update({
      status: "cancelled",
      cancelled_at: archivedAt,
    })
    .eq("id", membershipId)
    .select("id, status, cancelled_at")
    .maybeSingle();

  if (updateError) {
    throw new Error(updateError.message);
  }

  if (!updated || updated.status !== "cancelled") {
    throw new Error("Membership archive did not persist");
  }

  let obligationsVoided = 0;
  const { data: voidedObligations, error: obligationError } = await supabase
    .from("obligations")
    .update({
      status: "void",
      disposition: "waived",
      disposition_reason: reason,
    })
    .eq("membership_id", membershipId)
    .in("status", ["promised", "scheduled"])
    .select("id");

  if (obligationError) {
    if (!obligationError.message.includes("does not exist")) {
      console.warn(
        "[archive-membership] open obligations not voided:",
        obligationError.message,
      );
    }
  } else {
    obligationsVoided = voidedObligations?.length ?? 0;
  }

  console.info("[archive-membership]", {
    membershipId,
    previousStatus: row.status,
    archivedAt,
    reason,
    homeownerId: row.homeowner_id,
    propertyId: row.property_id,
    agreementId: row.agreement_id,
    obligationsVoided,
  });

  return {
    membershipId,
    archivedAt,
    previousStatus: row.status,
    obligationsVoided,
  };
}
