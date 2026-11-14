import "server-only";

import { ensureHomeownerConversation } from "@/lib/communications/repository";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";

/** The RPC accepts only the consent captured with this exact signed agreement. */
export async function recordSignTogetherReminderConsent(input: {
  agreementId: string;
  homeownerId: string;
  phone: string | null;
}): Promise<void> {
  if (!input.phone) return;
  const conversation = await ensureHomeownerConversation({
    homeownerId: input.homeownerId,
    subject: "Service visit updates",
  });
  const result = await createServiceRoleSupabaseClient().rpc(
    "record_signed_agreement_visit_sms_consent",
    {
      p_agreement_id: input.agreementId,
      p_conversation_id: conversation.id,
      p_address_normalized: input.phone,
    },
  );
  if (result.error) throw new Error("Visit text consent could not be recorded safely.");
}
