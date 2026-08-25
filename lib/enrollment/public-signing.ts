import "server-only";

import { createDocuSignRecipientView } from "@/lib/integrations/docusign";
import { resolvePublicAppOrigin } from "@/lib/membership/portal-access";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { enrollmentTokenSha256, isPlausibleEnrollmentToken } from "./token";
import type { EnrollmentDocumentSnapshot, EnrollmentPacketRow } from "./types";

export class EnrollmentSigningUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnrollmentSigningUnavailableError";
  }
}

export async function createPublicEnrollmentSigningSession(
  token: string,
): Promise<string | null> {
  if (!isPlausibleEnrollmentToken(token)) return null;

  const supabase = createServiceRoleSupabaseClient();
  const result = await supabase
    .from("enrollment_packets")
    .select("*")
    .eq("public_token_sha256", enrollmentTokenSha256(token))
    .maybeSingle();
  if (result.error || !result.data) return null;

  const packet = result.data as EnrollmentPacketRow;
  if (new Date(packet.public_token_expires_at).getTime() <= Date.now()) {
    return null;
  }
  if (packet.status !== "signature_sent" || !packet.docusign_envelope_id) {
    throw new EnrollmentSigningUnavailableError(
      packet.signed_at
        ? "This agreement has already been completed."
        : "This agreement is not available for signing right now.",
    );
  }

  const returnUrl = `${resolvePublicAppOrigin()}/enroll/${encodeURIComponent(token)}?signing=returned`;
  return createDocuSignRecipientView({
    envelopeId: packet.docusign_envelope_id,
    packetId: packet.id,
    snapshot: packet.document_snapshot as EnrollmentDocumentSnapshot,
    returnUrl,
  });
}
