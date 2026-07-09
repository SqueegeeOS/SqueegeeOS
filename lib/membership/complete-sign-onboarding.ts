import { generateSignedPDF } from "@/lib/agreement/generate-signed-pdf";
import type { AgreementEmailResult } from "@/lib/agreement/agreement-email-types";
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
  parseClientAddress,
} from "@/lib/presentations/parse-client-address";
import type { PresentationQuoteSnapshot } from "@/lib/presentations/quote-snapshot";
import type { PresentationData } from "@/lib/presentations/types";

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
  const parsedAddress = parseClientAddress(
    presentation.clientAddress,
    presentation.clientName,
  );
  const pricing = buildMembershipPricingFields({
    tier: input.agreementTier,
    visitPrice: input.visitPrice,
    planName: input.planName,
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

  const { data: existingMembership } = await supabase
    .from("memberships")
    .select("portal_access_token")
    .eq("property_id", property.id)
    .maybeSingle();

  const portalAccessToken =
    (existingMembership?.portal_access_token as string | null | undefined) ??
    generatePortalAccessToken();

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .upsert(
      {
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
      },
      { onConflict: "property_id" },
    )
    .select("id")
    .single();

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
  });

  const fileName = `${input.homeownerSlug}-${input.propertySlug}-agreement-${Date.now()}.pdf`;
  const storedPdf = await storeSignedPdf(pdfBytes, fileName);
  const pdfStorageRef = storedPdf.url;

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
      signature_image_url: storedSignature?.storageRef ?? input.signatureDataUrl,
      typed_text: null,
      signed_at: input.signedAt,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
      agreement_pdf_url: pdfStorageRef,
      signature_image_storage_path: storedSignature?.storagePath ?? null,
      status: "complete",
      storage_backend: "supabase",
    })
    .select("id")
    .single();

  if (agreementError || !agreement?.id) {
    throw new SignOnboardingError(
      `Agreement signed locally but failed to save: ${agreementError?.message ?? "unknown error"}`,
      { membershipId, onboardingStatus: "pending_payment" },
    );
  }

  const agreementId = agreement.id as string;

  const { error: membershipLinkError } = await supabase
    .from("memberships")
    .update({
      agreement_id: agreementId,
      presentation_id: presentation.id,
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
      monthly_rate: input.visitPrice,
      annual_rate: pricing.annualRate,
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

  if (memberEmail) {
    email = await sendAgreementEmail({
      to: memberEmail,
      name: presentation.clientName,
      pdfUrl: pdfStorageRef,
      tier: input.planName,
      pdfBytes,
      fileName: storedPdf.fileName,
      portalUrl,
    });
  } else {
    console.warn("[onboarding] agreement email skipped — no customer email on presentation", {
      presentationId: presentation.id,
      clientEmail: presentation.clientEmail || "(empty)",
    });
  }

  return {
    pdfUrl: storedPdf.accessUrl ?? pdfStorageRef,
    pdfStorageBackend: storedPdf.backend,
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
