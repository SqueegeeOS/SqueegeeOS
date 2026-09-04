import { getLeadIntakeById } from "@/lib/acquisition/leads/repository";
import { createServerSupabaseClient } from "@/lib/persistence/supabase/client";
import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import {
  technicianReferralCredit,
  type TechnicianReferralCredit,
} from "./technician-referral-credit";

/** Credit follows explicit lineage, never a customer's name, email or address. */
export async function loadPresentationTechnicianReferralCredit(
  presentationId: string | null | undefined,
): Promise<TechnicianReferralCredit | null> {
  if (!presentationId) return null;
  if (!isCloudPersistenceConnected()) return { status: "unavailable" };
  try {
    // No local presentation fallback: credit must come from the durable record.
    const { data: presentation, error } = await createServerSupabaseClient()
      .from("presentations")
      .select("id, lead_intake_id")
      .eq("id", presentationId)
      .maybeSingle();
    if (error || !presentation) return { status: "unavailable" };
    if (!presentation.lead_intake_id) return null;
    const lead = await getLeadIntakeById(presentation.lead_intake_id);
    if (!lead) return { status: "unavailable" };
    return technicianReferralCredit(lead, presentation.id);
  } catch {
    // Keep the workspace usable, but never silently turn a failed credit read
    // into "no referral" or fall back to a different customer's inquiry.
    return { status: "unavailable" };
  }
}
