import {
  createServiceRoleSupabaseClient,
  isServiceRoleConfigured,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";
import {
  formatSignedAgreementStorageRef,
  SIGNED_AGREEMENT_BUCKET,
} from "./signed-agreement-storage";

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
 * Falls back to null when storage is unavailable (caller keeps data URL in DB).
 */
export async function storeSignatureImage(
  signatureDataUrl: string,
  fileName: string,
): Promise<StoredSignatureResult | null> {
  const bytes = decodeSignatureDataUrl(signatureDataUrl);
  if (!bytes || bytes.byteLength === 0) return null;

  if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
    return null;
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
    console.error("[agreement] signature image upload failed:", error.message);
    return null;
  }

  return {
    storageRef: formatSignedAgreementStorageRef(storagePath),
    storagePath,
  };
}
