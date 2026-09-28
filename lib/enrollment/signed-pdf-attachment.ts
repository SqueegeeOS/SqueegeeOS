import "server-only";

import {
  parseSignedAgreementStoragePath,
  SIGNED_AGREEMENT_BUCKET,
} from "@/lib/agreement/signed-agreement-storage";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import type { EnrollmentPacketRow } from "./types";

const MAX_AGREEMENT_BYTES = 10 * 1024 * 1024;

export async function loadEnrollmentSignedPdfAttachment(
  packet: EnrollmentPacketRow,
  membershipId: string,
): Promise<{ filename: string; content: string }> {
  if (!packet.signed_at || !packet.signed_agreement_id) {
    throw new Error("The signed agreement is not linked to this enrollment packet.");
  }
  const supabase = createServiceRoleSupabaseClient();
  const result = await supabase
    .from("signed_agreements")
    .select("agreement_pdf_url")
    .eq("id", packet.signed_agreement_id)
    .eq("membership_id", membershipId)
    .eq("presentation_id", packet.presentation_id)
    .eq("status", "complete")
    .maybeSingle();
  if (result.error || !result.data?.agreement_pdf_url) {
    throw new Error("The packet's signed agreement could not be retrieved.");
  }
  const storagePath = parseSignedAgreementStoragePath(
    result.data.agreement_pdf_url as string,
  );
  if (!storagePath) throw new Error("The signed agreement is not in the private vault.");
  const downloaded = await supabase.storage
    .from(SIGNED_AGREEMENT_BUCKET)
    .download(storagePath);
  if (downloaded.error || !downloaded.data) {
    throw new Error("The signed agreement PDF could not be downloaded.");
  }
  if (downloaded.data.size > MAX_AGREEMENT_BYTES) {
    throw new Error("The signed agreement PDF exceeds the email attachment limit.");
  }
  const bytes = Buffer.from(await downloaded.data.arrayBuffer());
  if (
    bytes.length < 8 ||
    bytes.length > MAX_AGREEMENT_BYTES ||
    bytes.subarray(0, 5).toString() !== "%PDF-"
  ) {
    throw new Error("The signed agreement PDF failed its file check.");
  }
  return {
    filename: "HomeAtlas-signed-agreement.pdf",
    content: bytes.toString("base64"),
  };
}
