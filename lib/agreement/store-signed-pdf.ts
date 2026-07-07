import {
  createServerSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";

export type PdfStorageBackend = "supabase" | "data_url";

export interface StoredPdfResult {
  url: string;
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
  if (isSupabaseConfigured()) {
    const supabase = createServerSupabaseClient();
    const { error } = await supabase.storage
      .from("signed-agreements")
      .upload(fileName, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (!error) {
      const { data } = supabase.storage
        .from("signed-agreements")
        .getPublicUrl(fileName);
      const publicUrl = data.publicUrl;
      console.info(
        "[agreement] PDF stored in signed-agreements bucket:",
        fileName,
      );
      return {
        url: publicUrl,
        backend: "supabase",
        isEmailSafe: isEmailSafePdfUrl(publicUrl),
        fileName,
      };
    }

    console.error(
      "[agreement] signed-agreements upload failed — ensure the bucket exists and is public:",
      error.message,
    );
  } else {
    console.warn("[agreement] Supabase not configured — PDF will use data URL");
  }

  const base64 = Buffer.from(pdfBytes).toString("base64");
  return {
    url: `data:application/pdf;base64,${base64}`,
    backend: "data_url",
    isEmailSafe: false,
    fileName,
  };
}
