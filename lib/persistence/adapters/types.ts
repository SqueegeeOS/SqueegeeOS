import type { HomeCarePlanData } from "@/lib/home-care-plan/types";
import type { HomeCarePlanDraft } from "@/lib/home-care-plan/create-types";
import type { MembershipAgreementRecord } from "@/lib/membership/types";
import type {
  PersistedHomeCarePlan,
  PersistedHomeCarePlanInput,
  PersistedHomeowner,
  PersistedHomeownerInput,
  PersistedMembership,
  PersistedMembershipInput,
  PersistedPhotoDocument,
  PersistedPhotoDocumentInput,
  PersistedProperty,
  PersistedPropertyInput,
  PersistedSignedAgreement,
  PersistedSignedAgreementInput,
  PersistenceBackend,
} from "../types";

export class PersistenceNotConnectedError extends Error {
  constructor(message = "Supabase persistence is not connected yet.") {
    super(message);
    this.name = "PersistenceNotConnectedError";
  }
}

export interface PersistenceAdapter {
  readonly backend: PersistenceBackend;
  readonly isCloudConnected: boolean;

  // Home Care Plans
  saveHomeCarePlan(
    input: PersistedHomeCarePlanInput,
  ): Promise<PersistedHomeCarePlan>;
  getHomeCarePlanBySlugs(
    homeownerSlug: string,
    propertySlug: string,
  ): Promise<PersistedHomeCarePlan | null>;
  listHomeCarePlans(): Promise<PersistedHomeCarePlan[]>;
  deleteHomeCarePlan(
    homeownerSlug: string,
    propertySlug: string,
  ): Promise<void>;

  // Homeowners & Properties (ready for Supabase — session stores minimally)
  upsertHomeowner(input: PersistedHomeownerInput): Promise<PersistedHomeowner>;
  getHomeownerBySlug(slug: string): Promise<PersistedHomeowner | null>;
  upsertProperty(input: PersistedPropertyInput): Promise<PersistedProperty>;
  getPropertyBySlug(
    homeownerSlug: string,
    propertySlug: string,
  ): Promise<PersistedProperty | null>;

  // Memberships
  saveMembership(input: PersistedMembershipInput): Promise<PersistedMembership>;
  getMembershipByProperty(
    homeownerSlug: string,
    propertySlug: string,
  ): Promise<PersistedMembership | null>;

  // Signed agreements
  saveSignedAgreement(
    input: PersistedSignedAgreementInput,
  ): Promise<PersistedSignedAgreement>;
  listSignedAgreementsByProperty(
    homeownerSlug: string,
    propertySlug: string,
  ): Promise<PersistedSignedAgreement[]>;

  // Photos & documents
  savePhotoDocument(
    input: PersistedPhotoDocumentInput,
  ): Promise<PersistedPhotoDocument>;
  listPhotoDocumentsByProperty(
    propertyId: string,
  ): Promise<PersistedPhotoDocument[]>;
}

/** Convenience helpers used by the app layer */
export interface HomeCarePlanPersistence {
  savePresentation(
    presentation: HomeCarePlanData,
    draft?: HomeCarePlanDraft | null,
  ): Promise<PersistedHomeCarePlan>;
  loadPresentation(
    homeownerSlug: string,
    propertySlug: string,
  ): Promise<HomeCarePlanData | null>;
}

export type { MembershipAgreementRecord };
