import "server-only";

import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { isEnrollmentPacketStatus } from "./packet-progress";
import type { EnrollmentPacketStatusSnapshot } from "./types";

export async function loadEnrollmentPacketStatus(
  presentationId: string,
): Promise<EnrollmentPacketStatusSnapshot | null> {
  const supabase = createServiceRoleSupabaseClient();
  const result = await supabase
    .from("enrollment_packets")
    .select("status, updated_at")
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
    updatedAt: result.data.updated_at,
  };
}
