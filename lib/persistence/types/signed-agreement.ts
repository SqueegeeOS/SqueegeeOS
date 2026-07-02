import type {
  AgreementCaptureMetadata,
  MembershipPlanId,
  SignatureMethod,
} from "@/lib/membership/types";

export type SignedAgreementStatus =
  | "mock"
  | "pending"
  | "complete"
  | "voided";

/**
 * Persisted signed agreement — maps to `signed_agreements` table in Supabase.
 */
export interface PersistedSignedAgreement {
  id: string;
  homeownerId: string | null;
  propertyId: string | null;
  membershipId: string | null;
  homeownerSlug: string;
  propertySlug: string;
  homeownerName: string;
  planId: MembershipPlanId;
  planName: string;
  signature: {
    method: SignatureMethod;
    signerName: string;
    signatureImageUrl: string | null;
    typedText: string | null;
  };
  metadata: AgreementCaptureMetadata;
  agreementPdfUrl: string | null;
  signatureImageStoragePath: string | null;
  status: SignedAgreementStatus;
  createdAt: string;
  updatedAt: string;
  storageBackend: "session" | "supabase";
}

export type PersistedSignedAgreementInput = Omit<
  PersistedSignedAgreement,
  "id" | "createdAt" | "updatedAt"
> & {
  id?: string;
};
