import "server-only";

import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { isEnrollmentPacketStatus } from "./packet-progress";
import type { EnrollmentPacketStatusSnapshot } from "./types";
import { normalizePaymentRail } from "@/lib/billing/payment-rail";

export async function loadEnrollmentPacketStatus(
  presentationId: string,
): Promise<EnrollmentPacketStatusSnapshot | null> {
  const supabase = createServiceRoleSupabaseClient();
  const result = await supabase
    .from("enrollment_packets")
    .select("status, payment_rail, updated_at")
    .eq("presentation_id", presentationId)
    .maybeSingle();

  if (result.error) {
    throw new Error("HomeAtlas could not verify the secure handoff status.");
  }
  if (!result.data) return null;
  if (!isEnrollmentPacketStatus(result.data.status)) {
    throw new Error("HomeAtlas received an unknown secure handoff status.");
  }

  return {
    status: result.data.status,
    paymentRail: normalizePaymentRail(result.data.payment_rail),
    updatedAt: result.data.updated_at,
  };
}
