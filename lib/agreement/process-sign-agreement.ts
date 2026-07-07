import { generateSignedPDF } from "@/lib/agreement/generate-signed-pdf";
import type { AgreementEmailResult } from "@/lib/agreement/agreement-email-types";
import { resolveMemberEmail } from "@/lib/agreement/resolve-member-email";
import { sendAgreementEmail } from "@/lib/agreement/send-agreement-email";
import { storeSignedPdf } from "@/lib/agreement/store-signed-pdf";
import {
  agreementKindForPlan,
} from "@/lib/agreement/one-time-agreement";
import type { AgreementKind } from "@/lib/agreement/one-time-agreement";
import type { MembershipPlanId } from "@/lib/membership/types";
import type { SqueegeeKingTierId } from "@/lib/membership/tier-config";
import {
  createServerSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";
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
  pdfStorageBackend: "supabase" | "data_url";
  agreementId: string;
  email: AgreementEmailResult;
  /** @deprecated use email.status === "sent" */
  emailSent: boolean;
}

function parsePriceNumber(price?: number): number | undefined {
  if (price === undefined || Number.isNaN(price)) return undefined;
  return price;
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
  const storedPdf = await storeSignedPdf(pdfBytes, fileName);
  const pdfUrl = storedPdf.url;

  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured — cannot persist signed agreement.",
    );
  }

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
      storage_backend: storedPdf.backend === "supabase" ? "supabase" : "session",
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(
      `Failed to save signed agreement: ${error?.message ?? "unknown error"}`,
    );
  }

  const memberEmail = resolveMemberEmail(input.memberEmail);
  let email: AgreementEmailResult = {
    status: "skipped",
    reason: "no_valid_recipient_email",
    recipient: input.memberEmail?.trim() || null,
  };

  if (memberEmail) {
    email = await sendAgreementEmail({
      to: memberEmail,
      name: input.memberName,
      pdfUrl,
      tier: input.planName,
      pdfBytes,
      fileName: storedPdf.fileName,
    });
  }

  return {
    pdfUrl,
    pdfStorageBackend: storedPdf.backend,
    agreementId: data.id,
    email,
    emailSent: email.status === "sent",
  };
}
