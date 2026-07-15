import {
  createServiceRoleSupabaseClient,
} from "@/lib/persistence/supabase/client";
import {
  createSignedAgreementAccessUrl,
  formatSignedAgreementStorageRef,
  SIGNED_AGREEMENT_BUCKET,
  SIGNED_AGREEMENT_URL_TTL_SECONDS,
} from "./signed-agreement-storage";
import { verifyExistingStorageEvidence } from "./verify-storage-evidence";

export type PdfStorageBackend = "supabase";

export interface StoredPdfResult {
  /** Verified private-storage reference persisted to agreement_pdf_url. */
  url: string;
  /** Short-lived HTTPS URL for API responses when available. */
  accessUrl: string | null;
  backend: PdfStorageBackend;
  /** True when the URL is an HTTPS link suitable for email (not a data URL) */
  isEmailSafe: boolean;
  fileName: string;
}

export function isEmailSafePdfUrl(url: string): boolean {
  return url.startsWith("https://") || url.startsWith("http://");
}

export async function storeSignedPdf(
  pdfBytes: Uint8Array,
  fileName: string,
): Promise<StoredPdfResult> {
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase.storage
    .from(SIGNED_AGREEMENT_BUCKET)
    .upload(fileName, pdfBytes, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (error) {
    if (!/already exists|duplicate/i.test(error.message)) {
      throw new Error(`Signed agreement PDF upload failed: ${error.message}`);
    }
    await verifyExistingStorageEvidence(
      SIGNED_AGREEMENT_BUCKET,
      fileName,
      pdfBytes,
    );
  }

  const storageRef = formatSignedAgreementStorageRef(fileName);
  const accessUrl = await createSignedAgreementAccessUrl(
    fileName,
    SIGNED_AGREEMENT_URL_TTL_SECONDS,
  );
  return {
    url: storageRef,
    accessUrl,
    backend: "supabase",
    isEmailSafe: false,
    fileName,
  };
}
