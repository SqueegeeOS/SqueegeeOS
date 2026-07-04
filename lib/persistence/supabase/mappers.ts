import type { HomeCarePlanDraft } from "@/lib/home-care-plan/create-types";
import type { HomeCarePlanData } from "@/lib/home-care-plan/types";
import type { SignatureMethod } from "@/lib/membership/types";
import type {
  PersistedHomeCarePlan,
  PersistedHomeowner,
  PersistedMembership,
  PersistedPhotoDocument,
  PersistedProperty,
  PersistedSignedAgreement,
} from "../types";

// --- Database row shapes (snake_case) ---

export interface HomeownerRow {
  id: string;
  slug: string;
  full_name: string;
  first_name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface PropertyRow {
  id: string;
  homeowner_id: string;
  slug: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  type: string;
  hero_image: string | null;
  home_care_score: number | null;
  health_status: string | null;
  year_built: number | null;
  square_feet: number | null;
  narrative: string | null;
  last_visit: string | null;
  created_at: string;
  updated_at: string;
}

export interface HomeCarePlanRow {
  id: string;
  homeowner_id: string | null;
  property_id: string | null;
  homeowner_slug: string;
  property_slug: string;
  status: string;
  presentation: HomeCarePlanData;
  draft: HomeCarePlanDraft | null;
  storage_backend: string;
  generated_at: string;
  updated_at: string;
}

export interface MembershipRow {
  id: string;
  homeowner_id: string;
  property_id: string;
  home_care_plan_id: string | null;
  plan_id: string;
  plan_name: string;
  price_display: string;
  billing_period: string;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  started_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SignedAgreementRow {
  id: string;
  homeowner_id: string | null;
  property_id: string | null;
  membership_id: string | null;
  homeowner_slug: string;
  property_slug: string;
  homeowner_name: string;
  plan_id: string;
  plan_name: string;
  signature_method: string;
  signer_name: string;
  signature_image_url: string | null;
  typed_text: string | null;
  signed_at: string;
  ip_address: string | null;
  user_agent: string | null;
  client_session_id: string | null;
  agreement_pdf_url: string | null;
  signature_image_storage_path: string | null;
  status: string;
  storage_backend: string;
  created_at: string;
  updated_at: string;
}

export interface PropertyAssetRow {
  id: string;
  property_id: string;
  homeowner_id: string;
  kind: string;
  category: string;
  title: string;
  description: string | null;
  storage_path: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  visit_id: string | null;
  signed_agreement_id: string | null;
  photo_source: string | null;
  is_primary: boolean;
  external_url: string | null;
  captured_at: string | null;
  created_at: string;
  updated_at: string;
}

// --- Row → domain ---

export function homeownerFromRow(row: HomeownerRow): PersistedHomeowner {
  return {
    id: row.id,
    slug: row.slug,
    fullName: row.full_name,
    firstName: row.first_name,
    email: row.email,
    phone: row.phone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function propertyFromRow(row: PropertyRow): PersistedProperty {
  return {
    id: row.id,
    homeownerId: row.homeowner_id,
    slug: row.slug,
    name: row.name,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip,
    type: row.type as PersistedProperty["type"],
    heroImage: row.hero_image,
    homeCareScore: row.home_care_score,
    healthStatus: row.health_status as PersistedProperty["healthStatus"],
    yearBuilt: row.year_built,
    squareFeet: row.square_feet,
    narrative: row.narrative,
    lastVisit: row.last_visit,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function homeCarePlanFromRow(row: HomeCarePlanRow): PersistedHomeCarePlan {
  return {
    id: row.id,
    homeownerId: row.homeowner_id,
    propertyId: row.property_id,
    homeownerSlug: row.homeowner_slug,
    propertySlug: row.property_slug,
    status: row.status as PersistedHomeCarePlan["status"],
    presentation: row.presentation,
    draft: row.draft,
    generatedAt: row.generated_at,
    updatedAt: row.updated_at,
    storageBackend: row.storage_backend as PersistedHomeCarePlan["storageBackend"],
  };
}

export function membershipFromRow(row: MembershipRow): PersistedMembership {
  return {
    id: row.id,
    homeownerId: row.homeowner_id,
    propertyId: row.property_id,
    homeCarePlanId: row.home_care_plan_id,
    planId: row.plan_id as PersistedMembership["planId"],
    planName: row.plan_name,
    priceDisplay: row.price_display,
    billingPeriod: row.billing_period,
    status: row.status as PersistedMembership["status"],
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    stripePriceId: row.stripe_price_id,
    startedAt: row.started_at,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function signedAgreementFromRow(
  row: SignedAgreementRow,
): PersistedSignedAgreement {
  return {
    id: row.id,
    homeownerId: row.homeowner_id,
    propertyId: row.property_id,
    membershipId: row.membership_id,
    homeownerSlug: row.homeowner_slug,
    propertySlug: row.property_slug,
    homeownerName: row.homeowner_name,
    planId: row.plan_id as PersistedSignedAgreement["planId"],
    planName: row.plan_name,
    signature: {
      method: row.signature_method as SignatureMethod,
      signerName: row.signer_name,
      signatureImageUrl: row.signature_image_url,
      typedText: row.typed_text,
    },
    metadata: {
      signedAt: row.signed_at,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      clientSessionId: row.client_session_id,
    },
    agreementPdfUrl: row.agreement_pdf_url,
    signatureImageStoragePath: row.signature_image_storage_path,
    status: row.status as PersistedSignedAgreement["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    storageBackend: row.storage_backend as PersistedSignedAgreement["storageBackend"],
  };
}

export function propertyAssetFromRow(row: PropertyAssetRow): PersistedPhotoDocument {
  return {
    id: row.id,
    propertyId: row.property_id,
    homeownerId: row.homeowner_id,
    kind: row.kind as PersistedPhotoDocument["kind"],
    category: row.category as PersistedPhotoDocument["category"],
    title: row.title,
    description: row.description,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    fileSizeBytes: row.file_size_bytes,
    visitId: row.visit_id,
    signedAgreementId: row.signed_agreement_id,
    photoSource: row.photo_source as PersistedPhotoDocument["photoSource"],
    isPrimary: row.is_primary ?? false,
    externalUrl: row.external_url,
    capturedAt: row.captured_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
