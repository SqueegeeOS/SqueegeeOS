import { generateSignedPDF } from "@/lib/agreement/generate-signed-pdf";
import { sendAgreementEmail } from "@/lib/agreement/send-agreement-email";
import {
  createServerSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";
import type { MembershipPlanId } from "@/lib/membership/types";
import type { SqueegeeKingTierId } from "@/lib/membership/tier-config";
import type { AgreementKind } from "@/lib/agreement/one-time-agreement";
import {
  agreementKindForPlan,
} from "@/lib/agreement/one-time-agreement";
import type { PresentationQuoteSnapshot } from "@/lib/presentations/quote-snapshot";

export interface SignAgreementRequest {
  memberName: string;
  memberEmail?: string | null;
  homeownerSlug: string;
  propertySlug: string;
  propertyName: string;
  planId: MembershipPlanId;
  planName: string;
  signatureDataUrl: string;
  signedAt: string;
  monthlyPrice?: number;
  agreementTier?: SqueegeeKingTierId;
  agreementKind?: AgreementKind;
  homeSqft?: number;
  twoStory?: boolean;
  includeScreens?: boolean;
  includeInterior?: boolean;
  quoteSnapshot?: PresentationQuoteSnapshot | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface SignAgreementResult {
  pdfUrl: string;
  agreementId: string;
  emailSent: boolean;
}

function parsePriceNumber(price?: number): number | undefined {
  if (price === undefined || Number.isNaN(price)) return undefined;
  return price;
}

async function storeSignedPdf(
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

export async function processSignAgreement(
  input: SignAgreementRequest,
): Promise<SignAgreementResult> {
  const pdfBytes = await generateSignedPDF({
    memberName: input.memberName,
    signedAt: input.signedAt,
    signatureDataUrl: input.signatureDataUrl,
    tier: input.planName,
    agreementTier: input.agreementTier,
    agreementKind: input.agreementKind ?? agreementKindForPlan(input.planId),
    propertyName: input.propertyName,
    monthlyPrice: parsePriceNumber(input.monthlyPrice),
    homeSqft: input.homeSqft,
    twoStory: input.twoStory,
    includeScreens: input.includeScreens,
    includeInterior: input.includeInterior,
    quoteSnapshot: input.quoteSnapshot,
  });

  const fileName = `${input.homeownerSlug}-${input.propertySlug}-agreement-${Date.now()}.pdf`;
  const pdfUrl = await storeSignedPdf(pdfBytes, fileName);

  let agreementId = crypto.randomUUID();

  if (isSupabaseConfigured()) {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("signed_agreements")
      .insert({
        homeowner_slug: input.homeownerSlug,
        property_slug: input.propertySlug,
        homeowner_name: input.memberName,
        plan_id: input.planId,
        plan_name: input.planName,
        signature_method: "drawn",
        signer_name: input.memberName,
        signature_image_url: input.signatureDataUrl,
        typed_text: null,
        signed_at: input.signedAt,
        ip_address: input.ipAddress ?? null,
        user_agent: input.userAgent ?? null,
        agreement_pdf_url: pdfUrl,
        signature_image_storage_path: null,
        status: "complete",
        storage_backend: "supabase",
      })
      .select("id")
      .single();

    if (error) {
      console.error("[agreement] DB insert failed:", error.message);
    } else if (data?.id) {
      agreementId = data.id;
    }
  }

  let emailSent = false;
  if (input.memberEmail) {
    const emailResult = await sendAgreementEmail({
      to: input.memberEmail,
      name: input.memberName,
      pdfUrl,
      tier: input.planName,
    });
    emailSent = emailResult.sent;
  }

  return { pdfUrl, agreementId, emailSent };
}
