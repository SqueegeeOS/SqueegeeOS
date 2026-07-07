import {
  createServiceRoleSupabaseClient,
  isServiceRoleConfigured,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";
import {
  createSignedAgreementAccessUrl,
  formatSignedAgreementStorageRef,
  SIGNED_AGREEMENT_BUCKET,
  SIGNED_AGREEMENT_URL_TTL_SECONDS,
} from "./signed-agreement-storage";

export type PdfStorageBackend = "supabase" | "data_url";

export interface StoredPdfResult {
  /** Value persisted to agreement_pdf_url (storage ref or data URL). */
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
  if (isSupabaseConfigured() && isServiceRoleConfigured()) {
    const supabase = createServiceRoleSupabaseClient();
    const { error } = await supabase.storage
      .from(SIGNED_AGREEMENT_BUCKET)
      .upload(fileName, pdfBytes, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (!error) {
      const storageRef = formatSignedAgreementStorageRef(fileName);
      const accessUrl = await createSignedAgreementAccessUrl(
        fileName,
        SIGNED_AGREEMENT_URL_TTL_SECONDS,
      );
      console.info(
        "[agreement] PDF stored in private signed-agreements bucket:",
        fileName,
      );
      return {
        url: storageRef,
        accessUrl,
        backend: "supabase",
        isEmailSafe: false,
        fileName,
      };
    }

    console.error(
      "[agreement] signed-agreements upload failed:",
      error.message,
    );
  } else if (isSupabaseConfigured()) {
    console.error(
      "[agreement] SUPABASE_SERVICE_ROLE_KEY is required for private signed-agreement storage",
    );
  } else {
    console.warn("[agreement] Supabase not configured — PDF will use data URL");
  }

  const base64 = Buffer.from(pdfBytes).toString("base64");
  return {
    url: `data:application/pdf;base64,${base64}`,
    accessUrl: null,
    backend: "data_url",
    isEmailSafe: false,
    fileName,
  };
}
