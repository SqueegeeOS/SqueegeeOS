import "server-only";

import { randomUUID } from "node:crypto";
import type { AgreementEmailResult } from "@/lib/agreement/agreement-email-types";
import { generateSignedPDF } from "@/lib/agreement/generate-signed-pdf";
import {
  decodeAndValidateSignaturePng,
  InvalidSignaturePngError,
} from "@/lib/agreement/validate-signature-png";
import { resolveMemberEmail } from "@/lib/agreement/resolve-member-email";
import { sendAgreementEmail } from "@/lib/agreement/send-agreement-email";
import {
  resolveAgreementPdfAccessUrl,
} from "@/lib/agreement/signed-agreement-storage";
import { storeSignatureImage } from "@/lib/agreement/store-signature-image";
import { storeSignedPdf } from "@/lib/agreement/store-signed-pdf";
import {
  resolveFoundingMemberFields,
} from "@/lib/membership/founding-member";
import {
  buildPortalAccessUrl,
  generatePortalAccessToken,
} from "@/lib/membership/portal-access";
import {
  buildPortalHomeCarePlanFromPresentation,
  persistPortalHomeCarePlan,
} from "@/lib/membership/portal-home-care-plan";
import {
  membershipLinkageConflictReason,
  propertyAuthorityAddressKey,
  presentationSourceSlug,
  signingEvidenceBytesSha256,
  verifiedPresentationAuthority,
  type ExistingMembershipLinkage,
} from "@/lib/membership/signing-coherence";
import {
  calculateAnnualFromVisits,
  formatTierPrice,
  planNameForAgreement,
  type SqueegeeKingTierId,
  SQUEEGEEKING_TIERS,
} from "@/lib/membership/tier-config";
import {
  createServiceRoleSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";
import type { MembershipSalesTier } from "@/lib/persistence/types/membership";
import {
  firstNameFromFullName,
  parseClientAddress,
} from "@/lib/presentations/parse-client-address";
import {
  enrollmentSavingsForPresentation,
  tierVisitPriceForPresentation,
} from "@/lib/presentations/calculations";
import type { PresentationData } from "@/lib/presentations/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface CompleteSignOnboardingInput {
  presentation: PresentationData;
  agreementTier: SqueegeeKingTierId;
  signatureDataUrl: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface CompleteSignOnboardingResult {
  pdfUrl: string;
  pdfStorageBackend: "supabase";
  agreementId: string;
  membershipId: string;
  homeownerId: string;
  propertyId: string;
  email: AgreementEmailResult;
  /** @deprecated use email.status === "sent" */
  emailSent: boolean;
  onboardingStatus: "pending_payment";
  portalUrl: string | null;
}

export function buildMembershipPricingFields(input: {
  tier: SqueegeeKingTierId;
  visitPrice: number;
  planName: string;
}) {
  const visitsPerYear = SQUEEGEEKING_TIERS[input.tier].visitsPerYear;
  const annualRate = calculateAnnualFromVisits(input.tier, input.visitPrice);
  return {
    salesTier: input.tier as MembershipSalesTier,
    visitPrice: input.visitPrice,
    annualRate,
    visitsPerYear,
    priceDisplay: `${formatTierPrice(input.visitPrice)}/visit`,
    billingPeriod: "per_visit",
    planName: input.planName,
  };
}

export class SignOnboardingError extends Error {
  constructor(
    message: string,
    readonly partial?: {
      membershipId?: string;
      agreementId?: string;
      onboardingStatus?: "pending_payment";
    },
  ) {
    super(message);
    this.name = "SignOnboardingError";
  }
}

export class SignOnboardingConflictError extends SignOnboardingError {
  constructor(message: string) {
    super(message);
    this.name = "SignOnboardingConflictError";
  }
}

export class SignOnboardingInputError extends SignOnboardingError {
  constructor(message: string) {
    super(message);
    this.name = "SignOnboardingInputError";
  }
}

export function isSignOnboardingAlreadyComplete(
  presentation: Pick<
    PresentationData,
    "status" | "membershipId" | "agreementId"
  >,
): boolean {
  return (
    presentation.status === "signed" &&
    Boolean(presentation.membershipId?.trim()) &&
    Boolean(presentation.agreementId?.trim())
  );
}

type SigningClaim = {
  outcome: "claimed" | "complete" | "conflict";
  attempt_id: string;
  agreement_tier: SqueegeeKingTierId;
  signature_sha256: string;
  presentation_authority_sha256: string;
  signed_at: string;
  agreement_id: string | null;
  status: "pending" | "complete" | "held";
};

const injectedFaults = new Set<string>();

function maybeInjectSigningFault(
  stage: "after_claim" | "after_customer" | "after_storage" | "after_finalize",
  presentationId: string,
): void {
  const faultKey = `${presentationId}:${stage}`;
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.PR1B_SIGNING_FAULT_STAGE === stage &&
    !injectedFaults.has(faultKey)
  ) {
    injectedFaults.add(faultKey);
    throw new SignOnboardingError(`Injected PR1b signing fault: ${stage}`);
  }
}

async function holdSigningAttempt(
  supabase: SupabaseClient,
  presentationId: string,
  reason: string,
): Promise<never> {
  const { error } = await supabase
    .from("presentation_signing_attempts")
    .update({
      status: "held",
      last_conflict_at: new Date().toISOString(),
      last_conflict_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("presentation_id", presentationId);
  if (error) {
    throw new SignOnboardingError(
      `Failed to hold ambiguous signing evidence: ${error.message}`,
    );
  }
  throw new SignOnboardingConflictError(
    "Signing evidence requires Headquarters review",
  );
}

async function claimSigningAttempt(
  supabase: SupabaseClient,
  input: CompleteSignOnboardingInput,
  signatureSha256: string,
  authoritySha256: string,
): Promise<SigningClaim> {
  const { data, error } = await supabase.rpc(
    "claim_presentation_signing_attempt",
    {
      p_presentation_id: input.presentation.id,
      p_attempt_id: randomUUID(),
      p_agreement_tier: input.agreementTier,
      p_signature_sha256: signatureSha256,
      p_presentation_authority_sha256: authoritySha256,
    },
  );
  if (error || !data) {
    throw new SignOnboardingError(
      `Failed to claim signing attempt: ${error?.message ?? "empty response"}`,
    );
  }
  const claim = data as SigningClaim;
  if (claim.outcome === "conflict" || claim.status === "held") {
    throw new SignOnboardingConflictError(
      "Conflicting signing evidence is held for Headquarters review",
    );
  }
  return claim;
}

async function loadCompletedAttempt(
  supabase: SupabaseClient,
  presentation: PresentationData,
  claim: SigningClaim,
): Promise<CompleteSignOnboardingResult> {
  const { data: agreement, error: agreementError } = await supabase
    .from("signed_agreements")
    .select(
      "id, membership_id, homeowner_id, property_id, agreement_pdf_url, signature_image_url, signature_image_storage_path, storage_backend, signing_attempt_id, signing_evidence_sha256, agreement_tier",
    )
    .eq("id", claim.agreement_id)
    .eq("presentation_id", presentation.id)
    .maybeSingle();
  if (
    agreementError ||
    !agreement?.id ||
    agreement.storage_backend !== "supabase" ||
    agreement.signing_attempt_id !== claim.attempt_id ||
    agreement.signing_evidence_sha256 !== claim.signature_sha256 ||
    agreement.agreement_tier !== claim.agreement_tier ||
    agreement.agreement_pdf_url !==
      `storage:signed-agreements/${presentation.id}/${claim.attempt_id}/agreement.pdf` ||
    agreement.signature_image_storage_path !==
      `signatures/${presentation.id}/${claim.attempt_id}/signature.png` ||
    agreement.signature_image_url !==
      `storage:signed-agreements/signatures/${presentation.id}/${claim.attempt_id}/signature.png`
  ) {
    return holdSigningAttempt(
      supabase,
      presentation.id,
      "completed agreement evidence did not match signing attempt",
    );
  }

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("id, homeowner_id, property_id, presentation_id, agreement_id, portal_access_token")
    .eq("id", agreement.membership_id)
    .maybeSingle();
  if (
    membershipError ||
    !membership?.id ||
    membership.presentation_id !== presentation.id ||
    membership.agreement_id !== agreement.id ||
    membership.homeowner_id !== agreement.homeowner_id ||
    membership.property_id !== agreement.property_id
  ) {
    return holdSigningAttempt(
      supabase,
      presentation.id,
      "completed membership linkage did not match signing attempt",
    );
  }

  const { data: currentPresentation, error: presentationError } = await supabase
    .from("presentations")
    .select(
      "status, agreement_id, membership_id, homeowner_id, property_id, authority_sha256",
    )
    .eq("id", presentation.id)
    .maybeSingle();
  if (
    presentationError ||
    currentPresentation?.status !== "signed" ||
    currentPresentation.agreement_id !== agreement.id ||
    currentPresentation.membership_id !== membership.id ||
    currentPresentation.homeowner_id !== agreement.homeowner_id ||
    currentPresentation.property_id !== agreement.property_id ||
    currentPresentation.authority_sha256 !==
      claim.presentation_authority_sha256
  ) {
    return holdSigningAttempt(
      supabase,
      presentation.id,
      "completed presentation linkage did not match signing attempt",
    );
  }

  const pdfUrl =
    (await resolveAgreementPdfAccessUrl(agreement.agreement_pdf_url as string)) ??
    (agreement.agreement_pdf_url as string);
  const portalToken = membership.portal_access_token as string | null;
  return {
    pdfUrl,
    pdfStorageBackend: "supabase",
    agreementId: agreement.id as string,
    membershipId: membership.id as string,
    homeownerId: membership.homeowner_id as string,
    propertyId: membership.property_id as string,
    email: { status: "skipped", reason: "already_signed", recipient: null },
    emailSent: false,
    onboardingStatus: "pending_payment",
    portalUrl: portalToken ? buildPortalAccessUrl(portalToken) : null,
  };
}

type CustomerContext = {
  homeownerId: string;
  propertyId: string;
  homeownerSlug: string;
  propertySlug: string;
  homeownerEmail: string | null;
};

function normalized(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

async function loadPrelinkedCustomerContext(
  supabase: SupabaseClient,
  presentation: PresentationData,
): Promise<CustomerContext | null> {
  if (!presentation.homeownerId && !presentation.propertyId) return null;
  if (!presentation.homeownerId || !presentation.propertyId) {
    return holdSigningAttempt(
      supabase,
      presentation.id,
      "presentation has incomplete customer linkage",
    );
  }
  const [{ data: homeowner }, { data: property }] = await Promise.all([
    supabase
      .from("homeowners")
      .select("id, slug, full_name, email")
      .eq("id", presentation.homeownerId)
      .maybeSingle(),
    supabase
      .from("properties")
      .select("id, homeowner_id, slug, address, city, state, zip, authority_address_key")
      .eq("id", presentation.propertyId)
      .maybeSingle(),
  ]);
  const parsedAddress = parseClientAddress(
    presentation.clientAddress,
    presentation.clientName,
  );
  if (
    !homeowner?.id ||
    !property?.id ||
    property.homeowner_id !== homeowner.id ||
    normalized(homeowner.full_name as string) !==
      normalized(presentation.clientName) ||
    (presentation.clientEmail &&
      normalized(homeowner.email as string | null) !==
        normalized(presentation.clientEmail)) ||
    property.authority_address_key !== propertyAuthorityAddressKey(parsedAddress)
  ) {
    return holdSigningAttempt(
      supabase,
      presentation.id,
      "prelinked customer identity is ambiguous",
    );
  }
  return {
    homeownerId: homeowner.id as string,
    propertyId: property.id as string,
    homeownerSlug: homeowner.slug as string,
    propertySlug: property.slug as string,
    homeownerEmail: (homeowner.email as string | null) ?? null,
  };
}

async function ensureSourceCustomerContext(
  supabase: SupabaseClient,
  presentation: PresentationData,
): Promise<CustomerContext> {
  const prelinked = await loadPrelinkedCustomerContext(supabase, presentation);
  if (prelinked) return prelinked;

  const parsedAddress = parseClientAddress(
    presentation.clientAddress,
    presentation.clientName,
  );
  const homeownerSlug = presentationSourceSlug(
    presentation.clientName,
    presentation.id,
    "client",
  );
  const propertySlug = presentationSourceSlug(
    presentation.clientAddress,
    presentation.id,
    "property",
  );

  let [homeownerResult, propertyResult] = await Promise.all([
    supabase
      .from("homeowners")
      .select("id, slug, full_name, email")
      .eq("source_presentation_id", presentation.id)
      .maybeSingle(),
    supabase
      .from("properties")
      .select("id, homeowner_id, slug, address, authority_address_key")
      .eq("source_presentation_id", presentation.id)
      .maybeSingle(),
  ]);
  if (homeownerResult.error || propertyResult.error) {
    throw new SignOnboardingError(
      `Failed to verify presentation customer source: ${
        homeownerResult.error?.message ?? propertyResult.error?.message
      }`,
    );
  }
  if (propertyResult.data && !homeownerResult.data) {
    return holdSigningAttempt(
      supabase,
      presentation.id,
      "presentation property source has no matching homeowner source",
    );
  }
  if (!propertyResult.data) {
    const { data: addressMatches, error: addressMatchError } = await supabase
      .from("properties")
      .select("id")
      .eq("authority_address_key", propertyAuthorityAddressKey(parsedAddress))
      .limit(2);
    if (addressMatchError) {
      throw new SignOnboardingError(
        `Failed to verify property identity: ${addressMatchError.message}`,
      );
    }
    if ((addressMatches ?? []).length > 0) {
      return holdSigningAttempt(
        supabase,
        presentation.id,
        "property address already exists without an explicit presentation linkage",
      );
    }
  }
  if (!homeownerResult.data) {
    const inserted = await supabase
      .from("homeowners")
      .insert({
        source_presentation_id: presentation.id,
        slug: homeownerSlug,
        full_name: presentation.clientName,
        first_name: firstNameFromFullName(presentation.clientName),
        email: presentation.clientEmail || null,
        phone: null,
      })
      .select("id, slug, full_name, email")
      .single();
    if (inserted.error?.code === "23505") {
      homeownerResult = await supabase
        .from("homeowners")
        .select("id, slug, full_name, email")
        .eq("source_presentation_id", presentation.id)
        .maybeSingle();
    } else {
      homeownerResult = inserted;
    }
  }
  const homeowner = homeownerResult.data;
  if (
    homeownerResult.error ||
    !homeowner?.id ||
    normalized(homeowner.full_name as string) !==
      normalized(presentation.clientName) ||
    normalized(homeowner.email as string | null) !==
      normalized(presentation.clientEmail)
  ) {
    return holdSigningAttempt(
      supabase,
      presentation.id,
      "presentation homeowner source identity conflicts",
    );
  }

  if (!propertyResult.data) {
    const inserted = await supabase
      .from("properties")
      .insert({
        source_presentation_id: presentation.id,
        homeowner_id: homeowner.id,
        slug: propertySlug,
        name: parsedAddress.propertyName,
        address: parsedAddress.address,
        city: parsedAddress.city,
        state: parsedAddress.state,
        zip: parsedAddress.zip,
        type: "Residence",
        square_feet: presentation.homeSqft,
      })
      .select("id, homeowner_id, slug, address, authority_address_key")
      .single();
    if (inserted.error?.code === "23505") {
      propertyResult = await supabase
        .from("properties")
        .select("id, homeowner_id, slug, address, authority_address_key")
        .eq("source_presentation_id", presentation.id)
        .maybeSingle();
    } else {
      propertyResult = inserted;
    }
  }
  const property = propertyResult.data;
  if (
    propertyResult.error ||
    !property?.id ||
    property.homeowner_id !== homeowner.id ||
    property.authority_address_key !== propertyAuthorityAddressKey(parsedAddress)
  ) {
    return holdSigningAttempt(
      supabase,
      presentation.id,
      "presentation property source identity conflicts",
    );
  }

  return {
    homeownerId: homeowner.id as string,
    propertyId: property.id as string,
    homeownerSlug: homeowner.slug as string,
    propertySlug: property.slug as string,
    homeownerEmail: (homeowner.email as string | null) ?? null,
  };
}

type MembershipContext = { id: string; portalAccessToken: string };

async function ensurePendingMembership(
  supabase: SupabaseClient,
  input: {
    presentationId: string;
    customer: CustomerContext;
    signedAt: string;
    pricing: ReturnType<typeof buildMembershipPricingFields>;
  },
): Promise<MembershipContext> {
  const select =
    "id, presentation_id, status, agreement_id, portal_access_token";
  let existing = await supabase
    .from("memberships")
    .select(select)
    .eq("property_id", input.customer.propertyId)
    .maybeSingle();

  if (existing.data) {
    const reason = membershipLinkageConflictReason(
      existing.data as ExistingMembershipLinkage,
      input.presentationId,
    );
    if (reason) {
      return holdSigningAttempt(supabase, input.presentationId, reason);
    }
  }

  if (!existing.data) {
    const founding = resolveFoundingMemberFields(input.signedAt);
    const inserted = await supabase
      .from("memberships")
      .insert({
        homeowner_id: input.customer.homeownerId,
        property_id: input.customer.propertyId,
        presentation_id: input.presentationId,
        plan_id: "preferred",
        plan_name: input.pricing.planName,
        price_display: input.pricing.priceDisplay,
        billing_period: input.pricing.billingPeriod,
        sales_tier: input.pricing.salesTier,
        visit_price: input.pricing.visitPrice,
        annual_rate: input.pricing.annualRate,
        visits_per_year: input.pricing.visitsPerYear,
        billing_schedule: "first_of_service_month",
        status: "pending_payment",
        started_at: input.signedAt,
        founding_member: founding.foundingMember,
        founding_member_since: founding.foundingMemberSince,
        portal_access_token: generatePortalAccessToken(),
      })
      .select(select)
      .single();
    if (inserted.error?.code === "23505") {
      existing = await supabase
        .from("memberships")
        .select(select)
        .eq("property_id", input.customer.propertyId)
        .maybeSingle();
      if (existing.data) {
        const reason = membershipLinkageConflictReason(
          existing.data as ExistingMembershipLinkage,
          input.presentationId,
        );
        if (reason) {
          return holdSigningAttempt(supabase, input.presentationId, reason);
        }
      }
    } else {
      existing = inserted;
    }
  }

  if (existing.error || !existing.data?.id || !existing.data.portal_access_token) {
    throw new SignOnboardingError(
      `Failed to create pending membership: ${existing.error?.message ?? "empty response"}`,
    );
  }
  return {
    id: existing.data.id as string,
    portalAccessToken: existing.data.portal_access_token as string,
  };
}

export async function completeSignOnboarding(
  input: CompleteSignOnboardingInput,
): Promise<CompleteSignOnboardingResult> {
  if (!isSupabaseConfigured()) {
    throw new SignOnboardingError(
      "Supabase is required to complete membership onboarding",
    );
  }
  const presentation = input.presentation;
  const authoritySha256 = verifiedPresentationAuthority(presentation);
  if (!authoritySha256) {
    throw new SignOnboardingConflictError(
      "Presentation pricing or identity authority is unverified",
    );
  }

  let signatureBytes: Uint8Array;
  try {
    signatureBytes = await decodeAndValidateSignaturePng(input.signatureDataUrl);
  } catch (error) {
    if (error instanceof InvalidSignaturePngError) {
      throw new SignOnboardingInputError("Signature PNG is invalid");
    }
    throw error;
  }

  const supabase = createServiceRoleSupabaseClient();
  const signatureSha256 = signingEvidenceBytesSha256(signatureBytes);
  const claim = await claimSigningAttempt(
    supabase,
    input,
    signatureSha256,
    authoritySha256,
  );
  if (claim.outcome === "complete") {
    return loadCompletedAttempt(supabase, presentation, claim);
  }
  maybeInjectSigningFault("after_claim", presentation.id);

  const signedAt = claim.signed_at;
  const parsedAddress = parseClientAddress(
    presentation.clientAddress,
    presentation.clientName,
  );
  const visitPrice = tierVisitPriceForPresentation(
    presentation,
    input.agreementTier,
  );
  const enrollmentSavings = enrollmentSavingsForPresentation(
    presentation,
    input.agreementTier,
  );
  const planName = planNameForAgreement(input.agreementTier);
  const pricing = buildMembershipPricingFields({
    tier: input.agreementTier,
    visitPrice,
    planName,
  });

  const customer = await ensureSourceCustomerContext(supabase, presentation);
  const membership = await ensurePendingMembership(supabase, {
    presentationId: presentation.id,
    customer,
    signedAt,
    pricing,
  });
  maybeInjectSigningFault("after_customer", presentation.id);

  const portalPlan = buildPortalHomeCarePlanFromPresentation({
    presentation,
    homeownerSlug: customer.homeownerSlug,
    propertySlug: customer.propertySlug,
    planName,
    agreementTier: input.agreementTier,
    visitPrice,
  });
  await persistPortalHomeCarePlan(supabase, {
    homeownerId: customer.homeownerId,
    propertyId: customer.propertyId,
    homeownerSlug: customer.homeownerSlug,
    propertySlug: customer.propertySlug,
    plan: portalPlan,
  });

  const pdfBytes = await generateSignedPDF({
    memberName: presentation.clientName,
    signedAt,
    signatureDataUrl: input.signatureDataUrl,
    tier: planName,
    agreementTier: input.agreementTier,
    propertyName: parsedAddress.propertyName,
    monthlyPrice: visitPrice,
    homeSqft: presentation.homeSqft,
    twoStory: presentation.twoStory,
    includeScreens: presentation.includeScreens,
    includeInterior: presentation.quoteSnapshot?.includeInterior ?? false,
    quoteSnapshot: presentation.quoteSnapshot,
    enrollmentSavings,
  });
  const basePath = `${presentation.id}/${claim.attempt_id}`;
  const storedPdf = await storeSignedPdf(pdfBytes, `${basePath}/agreement.pdf`);
  const storedSignature = await storeSignatureImage(
    input.signatureDataUrl,
    `${basePath}/signature.png`,
  );
  maybeInjectSigningFault("after_storage", presentation.id);

  const { data: finalized, error: finalizeError } = await supabase.rpc(
    "finalize_presentation_signing_attempt",
    {
      p_presentation_id: presentation.id,
      p_attempt_id: claim.attempt_id,
      p_homeowner_id: customer.homeownerId,
      p_property_id: customer.propertyId,
      p_membership_id: membership.id,
      p_homeowner_slug: customer.homeownerSlug,
      p_property_slug: customer.propertySlug,
      p_homeowner_name: presentation.clientName,
      p_plan_id: "preferred",
      p_plan_name: planName,
      p_signature_image_url: storedSignature.storageRef,
      p_signature_storage_path: storedSignature.storagePath,
      p_pdf_storage_ref: storedPdf.url,
      p_ip_address: input.ipAddress ?? null,
      p_user_agent: input.userAgent ?? null,
      p_visit_price: visitPrice,
      p_annual_rate: pricing.annualRate,
      p_enrollment_savings: enrollmentSavings,
    },
  );
  if (finalizeError || !finalized) {
    throw new SignOnboardingError(
      `Failed to finalize signing attempt: ${finalizeError?.message ?? "empty response"}`,
      { membershipId: membership.id, onboardingStatus: "pending_payment" },
    );
  }
  const finalResult = finalized as {
    outcome: "complete" | "replay" | "held";
    agreement_id?: string;
  };
  if (finalResult.outcome === "held" || !finalResult.agreement_id) {
    throw new SignOnboardingConflictError(
      "Signing linkage is held for Headquarters review",
    );
  }
  maybeInjectSigningFault("after_finalize", presentation.id);

  const completedClaim: SigningClaim = {
    ...claim,
    outcome: "complete",
    status: "complete",
    agreement_id: finalResult.agreement_id,
  };
  const coherent = await loadCompletedAttempt(
    supabase,
    presentation,
    completedClaim,
  );

  const memberEmail = resolveMemberEmail(
    presentation.clientEmail,
    customer.homeownerEmail,
  );
  let email: AgreementEmailResult = {
    status: "skipped",
    reason:
      finalResult.outcome === "replay"
        ? "already_signed"
        : "no_valid_recipient_email",
    recipient: memberEmail,
  };
  if (finalResult.outcome === "complete" && memberEmail) {
    email = await sendAgreementEmail({
      to: memberEmail,
      name: presentation.clientName,
      pdfUrl: storedPdf.url,
      tier: planName,
      pdfBytes,
      fileName: storedPdf.fileName,
      portalUrl: buildPortalAccessUrl(membership.portalAccessToken),
    });
  }

  if (finalResult.outcome === "complete" && presentation.clientEmail) {
    try {
      const { markReferralConverted } = await import(
        "@/lib/referrals/repository"
      );
      await markReferralConverted({
        email: presentation.clientEmail,
        membershipId: membership.id,
      });
    } catch {
      // Conversion tracking remains best-effort and cannot block signing.
    }
  }

  return {
    ...coherent,
    pdfUrl: storedPdf.accessUrl ?? coherent.pdfUrl,
    email,
    emailSent: email.status === "sent",
  };
}
