import { persistSignedAgreement } from "@/lib/persistence/repository";
import { agreementKindForPlan } from "@/lib/agreement/one-time-agreement";
import type {
  AgreementCaptureMetadata,
  MembershipAgreementRecord,
  MembershipSignature,
} from "./types";

export interface SignMembershipAgreementInput {
  signature: MembershipSignature;
  homeownerSlug: string;
  homeownerName: string;
  memberEmail?: string | null;
  monthlyPrice?: number;
}

/**
 * Production pipeline when membership is completed:
 *
 * 1. Generate signed agreement PDF (merge agreement template + signature + metadata)
 * 2. Save PDF to property documents (property-scoped storage)
 * 3. Save signature image (drawn PNG or rendered typed signature)
 * 4. Persist signed timestamp, IP/user metadata, plan, property, customer name
 * 5. Email signed agreement copy to customer
 * 6. Surface agreement in Member Portal → Documents
 */
export const MEMBERSHIP_AGREEMENT_PRODUCTION_STEPS = [
  "generate_signed_agreement_pdf",
  "save_pdf_to_property_documents",
  "save_signature_image",
  "persist_agreement_metadata",
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
 * Signs agreement via /api/sign-agreement — generates PDF, stores record, emails copy.
 */
export async function signMembershipAgreement(
  input: SignMembershipAgreementInput,
): Promise<MembershipAgreementRecord> {
  const { signature, homeownerSlug, homeownerName, memberEmail, monthlyPrice } =
    input;

  const response = await fetch("/api/sign-agreement", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      memberName: signature.signerName,
      memberEmail,
      homeownerSlug,
      propertySlug: signature.propertySlug,
      propertyName: signature.propertyName,
      planId: signature.planId,
      planName: signature.planName,
      signatureDataUrl: signature.signatureValue,
      signedAt: signature.signedAt,
      monthlyPrice,
      agreementKind: agreementKindForPlan(signature.planId),
    }),
  });

  if (!response.ok) {
    throw new Error("Agreement signing failed");
  }

  const { pdfUrl, agreementId } = (await response.json()) as {
    pdfUrl: string;
    agreementId: string;
  };

  const metadata: AgreementCaptureMetadata = {
    signedAt: signature.signedAt,
    ipAddress: null,
    userAgent:
      typeof navigator !== "undefined" ? navigator.userAgent : null,
    clientSessionId: null,
  };

  const record: MembershipAgreementRecord = {
    id: agreementId,
    propertySlug: signature.propertySlug,
    propertyName: signature.propertyName,
    homeownerSlug,
    homeownerName,
    planId: signature.planId,
    planName: signature.planName,
    signature: signatureToRecordFields(signature),
    metadata,
    agreementPdfUrl: pdfUrl,
    status: "complete",
  };

  await persistSignedAgreement(record);

  return record;
}

/**
 * Mock save — simulates persisting agreement + signature without PDF generation.
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
