import {
  createServiceRoleSupabaseClient,
} from "@/lib/persistence/supabase/client";
import {
  formatSignedAgreementStorageRef,
  SIGNED_AGREEMENT_BUCKET,
} from "./signed-agreement-storage";
import { verifyExistingStorageEvidence } from "./verify-storage-evidence";

export interface StoredSignatureResult {
  /** storage:signed-agreements/signatures/... */
  storageRef: string;
  /** Path within bucket (signatures/...) */
  storagePath: string;
}

function decodeSignatureDataUrl(dataUrl: string): Uint8Array | null {
  const match = dataUrl.match(/^data:image\/(?:png|jpeg);base64,(.+)$/i);
  if (!match?.[1]) return null;
  return Uint8Array.from(Buffer.from(match[1], "base64"));
}

/**
 * Persist drawn signature PNG to the private signed-agreements bucket.
 * Existing objects are accepted only when their bytes match this attempt.
 */
export async function storeSignatureImage(
  signatureDataUrl: string,
  fileName: string,
): Promise<StoredSignatureResult> {
  const bytes = decodeSignatureDataUrl(signatureDataUrl);
  if (!bytes || bytes.byteLength === 0) {
    throw new Error("Signature evidence is invalid");
  }

  const storagePath = fileName.startsWith("signatures/")
    ? fileName
    : `signatures/${fileName}`;

  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase.storage
    .from(SIGNED_AGREEMENT_BUCKET)
    .upload(storagePath, bytes, {
      contentType: "image/png",
      upsert: false,
    });

  if (error) {
    if (!/already exists|duplicate/i.test(error.message)) {
      throw new Error(`Signature evidence upload failed: ${error.message}`);
    }
    await verifyExistingStorageEvidence(
      SIGNED_AGREEMENT_BUCKET,
      storagePath,
      bytes,
    );
  }

  return {
    storageRef: formatSignedAgreementStorageRef(storagePath),
    storagePath,
  };
}
