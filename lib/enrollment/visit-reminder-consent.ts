import "server-only";

import { ensureHomeownerConversation } from "@/lib/communications/repository";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { normalizeNorthAmericanPhone } from "@/lib/sales/workspace-validation";
import type { EnrollmentPacketRow } from "./types";

export function enrollmentReminderPhone(input: {
  packetPhone: string | null | undefined;
  enteredPhone: unknown;
  optedIn: boolean;
}): string | null {
  if (!input.optedIn) return null;
  const source = input.packetPhone?.trim() || input.enteredPhone;
  const phone = normalizeNorthAmericanPhone(source);
  if (!phone) throw new Error("Enter a valid mobile number for visit reminders.");
  return phone;
}

export async function recordEnrollmentVisitReminderConsent(input: {
  packet: EnrollmentPacketRow;
  homeownerId: string;
  phone: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}): Promise<void> {
  if (!input.phone) return;
  const conversation = await ensureHomeownerConversation({
    homeownerId: input.homeownerId,
    subject: "Service visit updates",
  });
  const result = await createServiceRoleSupabaseClient().rpc(
    "record_signed_enrollment_visit_sms_consent",
    {
      p_packet_id: input.packet.id,
      p_conversation_id: conversation.id,
      p_address_normalized: input.phone,
      p_request_ip: input.ipAddress,
      p_user_agent: input.userAgent,
    },
  );
  if (result.error) throw new Error(result.error.message);
}
