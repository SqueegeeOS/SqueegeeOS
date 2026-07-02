import { persistSignedAgreement } from "@/lib/persistence/repository";
import type {
  AgreementCaptureMetadata,
  MembershipAgreementRecord,
  MembershipSignature,
} from "./types";

/**
 * Production pipeline when membership is completed (not connected yet):
 *
 * 1. Generate signed agreement PDF (merge agreement template + signature + metadata)
 * 2. Save PDF to property documents (property-scoped storage)
 * 3. Save signature image (drawn PNG or rendered typed signature)
 * 4. Persist signed timestamp, IP/user metadata, plan, property, customer name
 * 5. Email signed agreement copy to Noah / Squeegeeking (internal)
 * 6. Email signed agreement copy to customer
 * 7. Surface agreement in Member Portal → Documents
 *
 * Trigger: after successful Stripe Checkout (or mock completion in dev).
 * Email and PDF generation are separate services — wire via API routes later.
 */
export const MEMBERSHIP_AGREEMENT_PRODUCTION_STEPS = [
  "generate_signed_agreement_pdf",
  "save_pdf_to_property_documents",
  "save_signature_image",
  "persist_agreement_metadata",
  "email_agreement_internal",
  "email_agreement_customer",
  "store_in_member_portal_documents",
] as const;

export type MembershipAgreementProductionStep =
  (typeof MEMBERSHIP_AGREEMENT_PRODUCTION_STEPS)[number];

function buildMetadata(): AgreementCaptureMetadata {
  if (typeof window === "undefined") {
    return {
      signedAt: new Date().toISOString(),
      ipAddress: null,
      userAgent: null,
      clientSessionId: null,
    };
  }

  return {
    signedAt: new Date().toISOString(),
    ipAddress: null, // Captured server-side in production
    userAgent: navigator.userAgent,
    clientSessionId: null, // Session ID from auth/checkout in production
  };
}

function signatureToRecordFields(signature: MembershipSignature) {
  return {
    method: signature.method,
    signerName: signature.signerName,
    signatureImageUrl:
      signature.method === "drawn" ? signature.signatureValue : null,
    typedText: signature.method === "typed" ? signature.signatureValue : null,
  };
}

/**
 * Mock save — simulates persisting agreement + signature.
 * In production: POST /api/membership/agreement → storage + pipeline queue.
 */
export async function saveMembershipAgreementMock(
  signature: MembershipSignature,
  homeownerSlug: string,
  homeownerName: string,
): Promise<MembershipAgreementRecord> {
  await new Promise((resolve) => setTimeout(resolve, 600));

  const metadata: AgreementCaptureMetadata = {
    ...buildMetadata(),
    signedAt: signature.signedAt,
  };

  const record: MembershipAgreementRecord = {
    id: `mock_agreement_${signature.propertySlug}_${Date.now()}`,
    propertySlug: signature.propertySlug,
    propertyName: signature.propertyName,
    homeownerSlug,
    homeownerName,
    planId: signature.planId,
    planName: signature.planName,
    signature: signatureToRecordFields(signature),
    metadata,
    agreementPdfUrl: null,
    status: "mock",
  };

  await persistSignedAgreement(record);

  return record;
}
