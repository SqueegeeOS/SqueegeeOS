import {
  computePresentationRates,
  enrollmentSavingsForPresentation,
} from "@/lib/presentations/calculations";
import {
  isMembershipBillingAuthorized,
  membershipBillingTermsHash,
  MEMBERSHIP_BILLING_AUTHORIZATION_VERSION,
} from "@/lib/billing/membership-billing-authorization";
import { dollarsToBillingCents } from "@/lib/billing/automatic-billing-rules";
import type { AgreementEmailResult } from "@/lib/agreement/agreement-email-types";
import { generateSignedPDF } from "@/lib/agreement/generate-signed-pdf";
import { resolveMemberEmail } from "@/lib/agreement/resolve-member-email";
import { sendAgreementEmail } from "@/lib/agreement/send-agreement-email";
import { storeSignatureImage } from "@/lib/agreement/store-signature-image";
import { storeSignedPdf } from "@/lib/agreement/store-signed-pdf";
import type { MembershipPlanId } from "@/lib/membership/types";
import {
  calculateAnnualFromVisits,
  formatTierPrice,
  type SqueegeeKingTierId,
  SQUEEGEEKING_TIERS,
} from "@/lib/membership/tier-config";
import {
  createServerSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";
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
import type { MembershipSalesTier } from "@/lib/persistence/types/membership";
import {
  firstNameFromFullName,
  hasCompleteClientAddress,
  parseClientAddress,
} from "@/lib/presentations/parse-client-address";
import type { PresentationQuoteSnapshot } from "@/lib/presentations/quote-snapshot";
import type { PresentationData } from "@/lib/presentations/types";
import {
  legacyOverrideFieldsForTier,
  normalizeVisitRateOverrides,
} from "@/lib/presentations/calculations";

export interface CompleteSignOnboardingInput {
  presentation: PresentationData;
  agreementTier: SqueegeeKingTierId;
  visitPrice: number;
  signedAt: string;
  signatureDataUrl: string;
  planId: MembershipPlanId;
  planName: string;
  homeownerSlug: string;
  propertySlug: string;
  memberEmail?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  quoteSnapshot?: PresentationQuoteSnapshot | null;
}

export interface CompleteSignOnboardingResult {
  pdfUrl: string;
  pdfStorageBackend: "supabase" | "data_url";
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
  annualRate?: number;
  variableVisitPricing?: boolean;
}) {
  const visitsPerYear = SQUEEGEEKING_TIERS[input.tier].visitsPerYear;
  const annualRate =
    input.annualRate && input.annualRate > 0
      ? input.annualRate
      : calculateAnnualFromVisits(input.tier, input.visitPrice);
  return {
    salesTier: input.tier as MembershipSalesTier,
    visitPrice: input.visitPrice,
    annualRate,
    visitsPerYear,
    priceDisplay: `${formatTierPrice(input.visitPrice)}${
      input.variableVisitPricing ? " average" : ""
    }/visit`,
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

/**
 * True when a prior sign attempt already linked membership + agreement.
 * Safe to short-circuit without creating a second PDF / agreement row.
 */
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

export async function completeSignOnboarding(
  input: CompleteSignOnboardingInput,
): Promise<CompleteSignOnboardingResult> {
  if (!isSupabaseConfigured()) {
    throw new SignOnboardingError(
      "Supabase is required to complete membership onboarding. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  const supabase = createServerSupabaseClient();
  const presentation = input.presentation;

  if (isSignOnboardingAlreadyComplete(presentation)) {
    const membershipId = presentation.membershipId as string;
    const agreementId = presentation.agreementId as string;
    const { data: membershipRow } = await supabase
      .from("memberships")
      .select("id, portal_access_token, homeowner_id, property_id")
      .eq("id", membershipId)
      .maybeSingle();

    const { data: agreementRow } = await supabase
      .from("signed_agreements")
      .select("id, agreement_pdf_url, storage_backend")
      .eq("id", agreementId)
      .maybeSingle();

    if (membershipRow?.id && agreementRow?.id) {
      const portalToken = membershipRow.portal_access_token as string | null;
      return {
        pdfUrl: (agreementRow.agreement_pdf_url as string) || "",
        pdfStorageBackend:
          agreementRow.storage_backend === "supabase" ? "supabase" : "data_url",
        agreementId,
        membershipId,
        homeownerId: membershipRow.homeowner_id as string,
        propertyId: membershipRow.property_id as string,
        email: {
          status: "skipped",
          reason: "already_signed",
          recipient: null,
        },
        emailSent: false,
        onboardingStatus: "pending_payment",
        portalUrl: portalToken ? buildPortalAccessUrl(portalToken) : null,
      };
    }
  }
  const parsedAddress = parseClientAddress(
    presentation.clientAddress,
    presentation.clientName,
  );
  if (!hasCompleteClientAddress(parsedAddress)) {
    throw new SignOnboardingError(
      "A complete service address is required before membership onboarding.",
    );
  }
  const presentationRates = computePresentationRates({
    ...presentation,
    tier: input.agreementTier,
  });
  const hasCustomCarePlan =
    presentation.planMode === "custom" &&
    presentation.carePlan.tier === input.agreementTier &&
    Boolean(presentationRates.carePlanPricing);
  const pricing = buildMembershipPricingFields({
    tier: input.agreementTier,
    visitPrice: input.visitPrice,
    planName: input.planName,
    annualRate: hasCustomCarePlan ? presentationRates.annualRate : undefined,
    variableVisitPricing: hasCustomCarePlan,
  });

  const { data: homeowner, error: homeownerError } = await supabase
    .from("homeowners")
    .upsert(
      {
        slug: input.homeownerSlug,
        full_name: presentation.clientName,
        first_name: firstNameFromFullName(presentation.clientName),
        email: presentation.clientEmail || null,
        phone: null,
      },
      { onConflict: "slug" },
    )
    .select("id, email")
    .single();

  if (homeownerError || !homeowner?.id) {
    throw new SignOnboardingError(
      `Failed to create homeowner: ${homeownerError?.message ?? "unknown error"}`,
    );
  }

  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .upsert(
      {
        homeowner_id: homeowner.id,
        slug: input.propertySlug,
        name: parsedAddress.propertyName,
        address: parsedAddress.address,
        city: parsedAddress.city,
        state: parsedAddress.state,
        zip: parsedAddress.zip,
        type: "Residence",
        square_feet: presentation.homeSqft || null,
      },
      { onConflict: "homeowner_id,slug" },
    )
    .select("id")
    .single();

  if (propertyError || !property?.id) {
    throw new SignOnboardingError(
      `Failed to create property: ${propertyError?.message ?? "unknown error"}`,
    );
  }

  const founding = resolveFoundingMemberFields(input.signedAt);

  const { data: existingMembership, error: existingMembershipError } = await supabase
    .from("memberships")
    .select("id, presentation_id, portal_access_token")
    .eq("property_id", property.id)
    .in("status", ["pending_checkout", "pending_payment", "active", "paused"])
    .maybeSingle();
  if (existingMembershipError) {
    throw new SignOnboardingError(
      `Failed to check current membership: ${existingMembershipError.message}`,
    );
  }
  if (
    existingMembership &&
    existingMembership.presentation_id !== presentation.id
  ) {
    throw new SignOnboardingError(
      "This property already has a current membership. Archive it before starting a new agreement.",
    );
  }

  const portalAccessToken =
    (existingMembership?.portal_access_token as string | null | undefined) ??
    generatePortalAccessToken();

  let membership = existingMembership?.id
    ? { id: existingMembership.id as string }
    : null;
  let membershipError: { message: string; code?: string } | null = null;

  if (!membership) {
    const created = await supabase
      .from("memberships")
      .insert({
        homeowner_id: homeowner.id,
        property_id: property.id,
        presentation_id: presentation.id,
        plan_id: input.planId,
        plan_name: pricing.planName,
        price_display: pricing.priceDisplay,
        billing_period: pricing.billingPeriod,
        sales_tier: pricing.salesTier,
        visit_price: pricing.visitPrice,
        annual_rate: pricing.annualRate,
        visits_per_year: pricing.visitsPerYear,
        billing_schedule: "first_of_service_month",
        status: "pending_payment",
        started_at: input.signedAt,
        founding_member: founding.foundingMember,
        founding_member_since: founding.foundingMemberSince,
        portal_access_token: portalAccessToken,
      })
      .select("id")
      .single();
    membership = created.data as { id: string } | null;
    membershipError = created.error;
  }

  if (membershipError || !membership?.id) {
    throw new SignOnboardingError(
      `Failed to create membership: ${membershipError?.message ?? "unknown error"}`,
    );
  }

  const membershipId = membership.id as string;
  const portalUrl = buildPortalAccessUrl(portalAccessToken);

  const portalPlan = buildPortalHomeCarePlanFromPresentation({
    presentation,
    homeownerSlug: input.homeownerSlug,
    propertySlug: input.propertySlug,
    planName: pricing.planName,
    agreementTier: input.agreementTier,
    visitPrice: input.visitPrice,
  });

  try {
    await persistPortalHomeCarePlan(supabase, {
      homeownerId: homeowner.id as string,
      propertyId: property.id as string,
      homeownerSlug: input.homeownerSlug,
      propertySlug: input.propertySlug,
      plan: portalPlan,
    });
  } catch (error) {
    throw new SignOnboardingError(
      error instanceof Error
        ? error.message
        : "Failed to save portal home care plan",
      { membershipId, onboardingStatus: "pending_payment" },
    );
  }

  const { data: existingAgreement } = await supabase
    .from("signed_agreements")
    .select(
      "id, agreement_pdf_url, storage_backend, status, membership_id, property_id, billing_authorization_version, billing_authorized_at, authorized_visit_price_cents, billing_terms_hash",
    )
    .eq("presentation_id", presentation.id)
    .eq("status", "complete")
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let agreementId: string;
  let pdfStorageRef: string;
  let pdfAccessUrl: string;
  let pdfBackend: "supabase" | "data_url";
  let pdfBytesForEmail: Uint8Array | null = null;
  let pdfFileNameForEmail: string | null = null;
  const authorizedVisitPriceCents = dollarsToBillingCents(input.visitPrice);
  const billingTermsHash = membershipBillingTermsHash();
  let agreementBillingAuthorized = false;

  if (existingAgreement?.id) {
    agreementId = existingAgreement.id as string;
    pdfStorageRef = (existingAgreement.agreement_pdf_url as string) || "";
    pdfAccessUrl = pdfStorageRef;
    pdfBackend =
      existingAgreement.storage_backend === "supabase" ? "supabase" : "data_url";
    agreementBillingAuthorized = isMembershipBillingAuthorized({
      agreementId,
      agreementStatus: existingAgreement.status as string | null,
      agreementMembershipId:
        (existingAgreement.membership_id as string | null) ?? null,
      agreementPropertyId:
        (existingAgreement.property_id as string | null) ?? null,
      billingAuthorizationVersion:
        (existingAgreement.billing_authorization_version as string | null) ??
        null,
      billingAuthorizedAt:
        (existingAgreement.billing_authorized_at as string | null) ?? null,
      billingTermsHash:
        (existingAgreement.billing_terms_hash as string | null) ?? null,
      authorizedVisitPriceCents:
        (existingAgreement.authorized_visit_price_cents as number | null) ??
        null,
      membershipId,
      propertyId: property.id as string,
      currentVisitPriceCents: authorizedVisitPriceCents,
    });
  } else {
    const pdfBytes = await generateSignedPDF({
      memberName: presentation.clientName,
      signedAt: input.signedAt,
      signatureDataUrl: input.signatureDataUrl,
      tier: input.planName,
      agreementTier: input.agreementTier,
      propertyName: parsedAddress.propertyName,
      monthlyPrice: input.visitPrice,
      homeSqft: presentation.homeSqft,
      twoStory: presentation.twoStory,
      includeScreens: presentation.includeScreens,
      includeInterior: input.quoteSnapshot?.includeInterior ?? false,
      quoteSnapshot: input.quoteSnapshot,
      carePlan: hasCustomCarePlan ? presentation.carePlan : null,
      carePlanPricing: hasCustomCarePlan
        ? presentationRates.carePlanPricing
        : null,
      annualPrice: hasCustomCarePlan ? presentationRates.annualRate : undefined,
      enrollmentSavings: enrollmentSavingsForPresentation(
        presentation,
        input.agreementTier,
      ),
    });

    const fileName = `${input.homeownerSlug}-${input.propertySlug}-agreement-${Date.now()}.pdf`;
    const storedPdf = await storeSignedPdf(pdfBytes, fileName);
    pdfStorageRef = storedPdf.url;
    pdfAccessUrl = storedPdf.accessUrl ?? pdfStorageRef;
    pdfBackend = storedPdf.backend;
    pdfBytesForEmail = pdfBytes;
    pdfFileNameForEmail = storedPdf.fileName;

    const signatureFileName = `${input.homeownerSlug}-${input.propertySlug}-signature-${Date.now()}.png`;
    const storedSignature = await storeSignatureImage(
      input.signatureDataUrl,
      signatureFileName,
    );

    const { data: agreement, error: agreementError } = await supabase
      .from("signed_agreements")
      .insert({
        homeowner_id: homeowner.id,
        property_id: property.id,
        membership_id: membershipId,
        presentation_id: presentation.id,
        homeowner_slug: input.homeownerSlug,
        property_slug: input.propertySlug,
        homeowner_name: presentation.clientName,
        plan_id: input.planId,
        plan_name: input.planName,
        signature_method: "drawn",
        signer_name: presentation.clientName,
        signature_image_url:
          storedSignature?.storageRef ?? input.signatureDataUrl,
        typed_text: null,
        signed_at: input.signedAt,
        ip_address: input.ipAddress ?? null,
        user_agent: input.userAgent ?? null,
        agreement_pdf_url: pdfStorageRef,
        signature_image_storage_path: storedSignature?.storagePath ?? null,
        status: "complete",
        storage_backend: "supabase",
        billing_authorization_version:
          MEMBERSHIP_BILLING_AUTHORIZATION_VERSION,
        billing_authorized_at: input.signedAt,
        authorized_visit_price_cents: authorizedVisitPriceCents,
        billing_terms_hash: billingTermsHash,
      })
      .select("id")
      .single();

    if (agreementError || !agreement?.id) {
      throw new SignOnboardingError(
        `Agreement signed locally but failed to save: ${agreementError?.message ?? "unknown error"}`,
        { membershipId, onboardingStatus: "pending_payment" },
      );
    }

    agreementId = agreement.id as string;
    agreementBillingAuthorized = true;
  }

  if (agreementBillingAuthorized) {
    const authorizationEvidence = {
      membership_id: membershipId,
      agreement_id: agreementId,
      authorization_version: MEMBERSHIP_BILLING_AUTHORIZATION_VERSION,
      authorized_visit_price_cents: authorizedVisitPriceCents,
      billing_terms_hash: billingTermsHash,
      actor: "customer_signature",
      evidence_source: "customer_signature",
      occurred_at:
        (existingAgreement?.billing_authorized_at as string | null) ??
        input.signedAt,
    };
    const authorizationEvent = await supabase
      .from("membership_billing_authorization_events")
      .upsert(authorizationEvidence, {
        onConflict:
          "membership_id,agreement_id,authorization_version,evidence_source",
        ignoreDuplicates: true,
      });
    if (authorizationEvent.error) {
      throw new SignOnboardingError(
        `Agreement saved but billing authorization audit failed: ${authorizationEvent.error.message}`,
        { membershipId, agreementId, onboardingStatus: "pending_payment" },
      );
    }
    const storedEvidence = await supabase
      .from("membership_billing_authorization_events")
      .select("authorized_visit_price_cents, billing_terms_hash")
      .eq("membership_id", membershipId)
      .eq("agreement_id", agreementId)
      .eq("authorization_version", MEMBERSHIP_BILLING_AUTHORIZATION_VERSION)
      .eq("evidence_source", "customer_signature")
      .maybeSingle();
    if (
      storedEvidence.error ||
      !storedEvidence.data ||
      storedEvidence.data.authorized_visit_price_cents !==
        authorizedVisitPriceCents ||
      storedEvidence.data.billing_terms_hash !== billingTermsHash
    ) {
      throw new SignOnboardingError(
        `Agreement saved but billing authorization evidence could not be verified: ${storedEvidence.error?.message ?? "evidence mismatch"}`,
        { membershipId, agreementId, onboardingStatus: "pending_payment" },
      );
    }
  }

  const { error: membershipLinkError } = await supabase
    .from("memberships")
    .update({
      agreement_id: agreementId,
      presentation_id: presentation.id,
      automatic_billing_enabled: agreementBillingAuthorized,
      automatic_billing_paused_at: agreementBillingAuthorized
        ? null
        : new Date().toISOString(),
      automatic_billing_pause_reason: agreementBillingAuthorized
        ? null
        : "Signed agreement requires billing-authorization review",
    })
    .eq("id", membershipId);

  if (membershipLinkError) {
    console.error(
      "[onboarding] Membership link update failed:",
      membershipLinkError.message,
    );
  }

  const { error: presentationError } = await supabase
    .from("presentations")
    .update({
      status: "signed",
      signed_at: input.signedAt,
      agreement_id: agreementId,
      homeowner_id: homeowner.id,
      property_id: property.id,
      membership_id: membershipId,
      onboarding_status: "pending_payment",
      tier: input.agreementTier,
      annual_rate: pricing.annualRate,
      visit_rate_overrides: normalizeVisitRateOverrides(presentation),
      ...(() => {
        const overrides = normalizeVisitRateOverrides(presentation);
        const legacy = legacyOverrideFieldsForTier(
          overrides,
          input.agreementTier,
        );
        return {
          monthly_rate: legacy.monthlyRate,
          override_tier: legacy.overrideTier,
        };
      })(),
    })
    .eq("id", presentation.id);

  if (presentationError) {
    console.error(
      "[onboarding] Presentation link update failed:",
      presentationError.message,
    );
  }

  const memberEmail = resolveMemberEmail(
    input.memberEmail,
    presentation.clientEmail,
    homeowner.email as string | null,
  );

  let email: AgreementEmailResult = {
    status: "skipped",
    reason: "no_valid_recipient_email",
    recipient: presentation.clientEmail?.trim() || null,
  };

  if (memberEmail && pdfBytesForEmail && pdfFileNameForEmail) {
    email = await sendAgreementEmail({
      to: memberEmail,
      name: presentation.clientName,
      pdfUrl: pdfStorageRef,
      tier: input.planName,
      pdfBytes: pdfBytesForEmail,
      fileName: pdfFileNameForEmail,
      portalUrl,
    });
  } else if (memberEmail && !pdfBytesForEmail) {
    email = {
      status: "skipped",
      reason: "already_signed",
      recipient: memberEmail,
    };
  } else {
    console.warn("[onboarding] agreement email skipped — no customer email on presentation", {
      presentationId: presentation.id,
      clientEmail: presentation.clientEmail || "(empty)",
    });
  }

  // Referral conversion: if this new member arrived as a referred lead,
  // flip their pending referral to converted. Best-effort, never fatal.
  if (presentation.clientEmail) {
    try {
      const { markReferralConverted } = await import(
        "@/lib/referrals/repository"
      );
      await markReferralConverted({
        email: presentation.clientEmail,
        membershipId,
      });
    } catch {
      // conversion tracking must never block signing
    }
  }

  return {
    pdfUrl: pdfAccessUrl,
    pdfStorageBackend: pdfBackend,
    agreementId,
    membershipId,
    homeownerId: homeowner.id as string,
    propertyId: property.id as string,
    email,
    emailSent: email.status === "sent",
    onboardingStatus: "pending_payment",
    portalUrl,
  };
}
