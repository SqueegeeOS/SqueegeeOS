import "server-only";

import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import {
  enrollmentTokenSha256,
  isPlausibleEnrollmentToken,
} from "./token";
import type { EnrollmentPacketRow } from "./types";

export async function findEnrollmentPacketByToken(
  token: string,
): Promise<EnrollmentPacketRow | null> {
  if (!isPlausibleEnrollmentToken(token)) return null;

  const supabase = createServiceRoleSupabaseClient();
  const tokenSha256 = enrollmentTokenSha256(token);
  const current = await supabase
    .from("enrollment_packets")
    .select("*")
    .eq("public_token_sha256", tokenSha256)
    .maybeSingle();
  if (current.data) return current.data as EnrollmentPacketRow;

  const historical = await supabase
    .from("enrollment_packet_access_tokens")
    .select("enrollment_packet_id")
    .eq("token_sha256", tokenSha256)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (historical.error || !historical.data) return null;

  const packet = await supabase
    .from("enrollment_packets")
    .select("*")
    .eq("id", historical.data.enrollment_packet_id)
    .maybeSingle();
  if (packet.error || !packet.data) return null;
  return packet.data as EnrollmentPacketRow;
}

export async function rememberEnrollmentPacketAccessToken(input: {
  packetId: string;
  tokenSha256: string;
  expiresAt: string;
}): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const result = await supabase.from("enrollment_packet_access_tokens").upsert(
    {
      enrollment_packet_id: input.packetId,
      token_sha256: input.tokenSha256,
      expires_at: input.expiresAt,
    },
    { onConflict: "token_sha256", ignoreDuplicates: true },
  );
  if (result.error) {
    throw new Error(
      `The private agreement link history could not be saved: ${result.error.message}`,
    );
  }
}
