import {
  createServerSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";

export async function storeSignedPdf(
  pdfBytes: Uint8Array,
  fileName: string,
): Promise<string> {
  if (isSupabaseConfigured()) {
    const supabase = createServerSupabaseClient();
    const { error } = await supabase.storage
      .from("signed-agreements")
      .upload(fileName, pdfBytes, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (!error) {
      const { data } = supabase.storage
        .from("signed-agreements")
        .getPublicUrl(fileName);
      return data.publicUrl;
    }

    console.warn(
      "[agreement] Storage upload failed — falling back to data URL:",
      error.message,
    );
  }

  const base64 = Buffer.from(pdfBytes).toString("base64");
  return `data:application/pdf;base64,${base64}`;
}
