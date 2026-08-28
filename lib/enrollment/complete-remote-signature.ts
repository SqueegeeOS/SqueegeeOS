import "server-only";

import {
  MEMBERSHIP_BILLING_AUTHORIZATION_VERSION,
  membershipBillingTermsHash,
} from "@/lib/billing/membership-billing-authorization";
import { buildMembershipPricingFields } from "@/lib/membership/complete-sign-onboarding";
import { resolveFoundingMemberFields } from "@/lib/membership/founding-member";
import {
  buildPortalAccessUrl,
  generatePortalAccessToken,
} from "@/lib/membership/portal-access";
import {
  buildPortalHomeCarePlanFromPresentation,
  persistPortalHomeCarePlan,
} from "@/lib/membership/portal-home-care-plan";
import type { MembershipPlanId } from "@/lib/membership/types";
import { storeSignedPdf } from "@/lib/agreement/store-signed-pdf";
import { generateSignedPDF } from "@/lib/agreement/generate-signed-pdf";
import { storeSignatureImage } from "@/lib/agreement/store-signature-image";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import {
  firstNameFromFullName,
  hasCompleteClientAddress,
  parseClientAddress,
} from "@/lib/presentations/parse-client-address";
import {
  legacyOverrideFieldsForTier,
  normalizeVisitRateOverrides,
  scopedPresentationSlug,
} from "@/lib/presentations/calculations";
import { getPresentation } from "@/lib/presentations/repository";
import { normalizeNorthAmericanPhone } from "@/lib/sales/workspace-validation";
import { preserveSalesLeadSmsHandoff } from "@/lib/sales/lead-contact-handoff";
import { recordSignedMembershipAttribution } from "@/lib/sales/signed-attribution-server";
import { planNameForAgreement } from "@/lib/membership/tier-config";
import {
  DEFAULT_CARE_PLAN_SERVICE_PRICES,
  PRESENTATION_CARE_PLAN_VERSION,
} from "@/lib/presentations/care-plan";
import type { PresentationData } from "@/lib/presentations/types";
import type {
  EnrollmentDocumentSnapshot,
  EnrollmentPacketRow,
  EnrollmentSignatureProvider,
} from "./types";
import { isManualPaymentRail } from "@/lib/billing/payment-rail";
import { enrollmentMembershipBillingState } from "./membership-billing-state";

export interface RemoteSignatureCompletion {
  packetId: string;
  agreementId: string;
  membershipId: string;
  homeownerId: string;
  propertyId: string;
  portalUrl: string;
  alreadyCompleted: boolean;
  salesAttribution:
    | "recorded"
    | "not_rep_attributed"
    | "repair_required";
}

interface AgreementVersionRow {
  id: string;
  document_kind: "master_service_agreement" | "service_quote_agreement";
  version: string;
  status: string;
}

async function recordRemoteSalesAttribution(input: {
  packetId: string;
  presentationId: string;
  membershipId: string;
  agreementId: string;
  signedAt: string;
}): Promise<RemoteSignatureCompletion["salesAttribution"]> {
  try {
    const result = await recordSignedMembershipAttribution({
      presentationId: input.presentationId,
      membershipId: input.membershipId,
      agreementId: input.agreementId,
      signedAt: input.signedAt,
    });
    return result.status === "not_rep_attributed"
      ? "not_rep_attributed"
      : "recorded";
  } catch (error) {
    // Attribution is operational reporting, not permission to withhold a
    // customer's completed agreement. Stripe activation and the rep workspace
    // both retry this idempotent write, while this result remains in the packet
    // event ledger for an owner-visible repair trail.
    console.error("[remote-enrollment] sales attribution repair required", {
      packetId: input.packetId,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return "repair_required";
  }
}

function planId(): MembershipPlanId {
  return "preferred";
}

function safeFileSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 80);
}

async function loadAgreementVersions(input: {
  msaVersionId: string;
  serviceVersionId: string;
}): Promise<{ msa: AgreementVersionRow; service: AgreementVersionRow }> {
  const supabase = createServiceRoleSupabaseClient();
  const result = await supabase
    .from("agreement_document_versions")
    .select("id, document_kind, version, status")
    .in("id", [input.msaVersionId, input.serviceVersionId]);
  if (result.error) throw new Error(result.error.message);
  const rows = (result.data ?? []) as AgreementVersionRow[];
  const msa = rows.find(
    (row) =>
      row.id === input.msaVersionId &&
      row.document_kind === "master_service_agreement" &&
      row.status === "approved",
  );
  const service = rows.find(
    (row) =>
      row.id === input.serviceVersionId &&
      row.document_kind === "service_quote_agreement" &&
      row.status === "approved",
  );
  if (!msa || !service) {
    throw new Error(
      "The signed envelope is not bound to both currently released legal document versions.",
    );
  }
  return { msa, service };
}

export async function completeRemoteEnrollmentSignature(input: {
  packet: EnrollmentPacketRow & {
    msa_version_id: string;
    service_agreement_version_id: string;
  };
  signedAt: string;
  combinedPdf?: Uint8Array;
  certificatePdf?: Uint8Array;
  signatureProvider?: EnrollmentSignatureProvider;
  signatureDataUrl?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<RemoteSignatureCompletion> {
  const supabase = createServiceRoleSupabaseClient();
  const packet = input.packet;
  const signatureProvider = input.signatureProvider ?? "docusign";
  const externalSignatureId =
    signatureProvider === "docusign" ? packet.docusign_envelope_id : packet.id;
  if (!externalSignatureId) {
    throw new Error("The packet has no signature-provider binding.");
  }
  const manualPayment = isManualPaymentRail(packet.payment_rail);
  const existingAgreement = await supabase
    .from("signed_agreements")
    .select("id, membership_id, homeowner_id, property_id")
    .eq("external_signature_provider", signatureProvider)
    .eq("external_envelope_id", externalSignatureId)
    .maybeSingle();
  if (existingAgreement.error) throw new Error(existingAgreement.error.message);
  if (
    existingAgreement.data?.id &&
    existingAgreement.data.membership_id &&
    existingAgreement.data.homeowner_id &&
    existingAgreement.data.property_id
  ) {
    const membershipResult = await supabase
      .from("memberships")
      .select("portal_access_token")
      .eq("id", existingAgreement.data.membership_id)
      .maybeSingle();
    if (membershipResult.error) throw new Error(membershipResult.error.message);
    if (!membershipResult.data?.portal_access_token) {
      throw new Error("The completed membership is missing its portal access token.");
    }
    const salesAttribution = await recordRemoteSalesAttribution({
      packetId: packet.id,
      presentationId: packet.presentation_id,
      membershipId: existingAgreement.data.membership_id as string,
      agreementId: existingAgreement.data.id as string,
      signedAt: input.signedAt,
    });
    return {
      packetId: packet.id,
      agreementId: existingAgreement.data.id as string,
      membershipId: existingAgreement.data.membership_id as string,
      homeownerId: existingAgreement.data.homeowner_id as string,
      propertyId: existingAgreement.data.property_id as string,
      portalUrl: buildPortalAccessUrl(
        membershipResult.data.portal_access_token as string,
      ),
      alreadyCompleted: true,
      salesAttribution,
    };
  }

  if (signatureProvider === "docusign" && !packet.docusign_envelope_id) {
    throw new Error("The packet has no DocuSign envelope binding.");
  }
  if (
    signatureProvider === "homeatlas_native" &&
    !/^data:image\/png;base64,/i.test(input.signatureDataUrl ?? "")
  ) {
    throw new Error("The HomeAtlas signature image is missing or invalid.");
  }
  const presentation = await getPresentation(packet.presentation_id);
  if (!presentation) throw new Error("The enrollment presentation no longer exists.");
  const snapshot = packet.document_snapshot as EnrollmentDocumentSnapshot;
  if (
    snapshot.presentationId !== presentation.id ||
    snapshot.customer.email !== packet.customer_email ||
    snapshot.plan.tier !== packet.agreement_tier ||
    snapshot.plan.firstVisitPriceCents !== packet.first_visit_price_cents ||
    snapshot.plan.recurringVisitPriceCents !==
      packet.recurring_visit_price_cents ||
    snapshot.plan.annualizedValueCents !== packet.annualized_value_cents
  ) {
    throw new Error("The signed document snapshot does not match its enrollment packet.");
  }
  const address = parseClientAddress(
    snapshot.property.fullAddress,
    snapshot.customer.name,
  );
  if (!hasCompleteClientAddress(address)) {
    throw new Error("A complete service address is required to activate enrollment.");
  }
  const versions = await loadAgreementVersions({
    msaVersionId: packet.msa_version_id,
    serviceVersionId: packet.service_agreement_version_id,
  });
  const normalizedPhone = normalizeNorthAmericanPhone(snapshot.customer.phone ?? "");
  if (snapshot.customer.phone?.trim() && !normalizedPhone) {
    throw new Error("The presentation contains an invalid customer phone number.");
  }

  // Presentation-scoped slugs prevent a same-name customer or repeated street
  // name from mutating an unrelated homeowner/property during webhook retries.
  const homeownerSlug = scopedPresentationSlug(
    snapshot.customer.name,
    presentation.id,
    "member",
  );
  const propertySlug = scopedPresentationSlug(
    snapshot.property.fullAddress,
    presentation.id,
    "property",
  );
  const homeownerResult = await supabase
    .from("homeowners")
    .upsert(
      {
        slug: homeownerSlug,
        full_name: snapshot.customer.name,
        first_name: firstNameFromFullName(snapshot.customer.name),
        email: snapshot.customer.email,
        ...(normalizedPhone ? { phone: normalizedPhone } : {}),
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();
  if (homeownerResult.error || !homeownerResult.data?.id) {
    throw new Error(
      `Failed to create the homeowner record: ${homeownerResult.error?.message ?? "unknown"}`,
    );
  }
  const homeownerId = homeownerResult.data.id as string;

  await preserveSalesLeadSmsHandoff({
    supabase,
    homeownerId,
    salesRepLeadId: presentation.salesRepLeadId,
    presentationPhone: normalizedPhone,
  }).catch((error) => {
    console.warn("[remote-enrollment] contact handoff skipped", {
      packetId: packet.id,
      reason: error instanceof Error ? error.message : "unknown",
    });
  });

  const propertyResult = await supabase
    .from("properties")
    .upsert(
      {
        homeowner_id: homeownerId,
        slug: propertySlug,
        name: address.propertyName,
        address: address.address,
        city: address.city,
        state: address.state,
        zip: address.zip,
        type: "Residence",
        square_feet: snapshot.property.squareFeet,
      },
      { onConflict: "homeowner_id,slug" },
    )
    .select("id")
    .single();
  if (propertyResult.error || !propertyResult.data?.id) {
    throw new Error(
      `Failed to create the property record: ${propertyResult.error?.message ?? "unknown"}`,
    );
  }
  const propertyId = propertyResult.data.id as string;

  const currentMembership = await supabase
    .from("memberships")
    .select("id, presentation_id, portal_access_token")
    .eq("property_id", propertyId)
    .in("status", ["pending_checkout", "pending_payment", "active", "paused"])
    .maybeSingle();
  if (currentMembership.error) throw new Error(currentMembership.error.message);
  if (
    currentMembership.data &&
    currentMembership.data.presentation_id !== presentation.id
  ) {
    throw new Error(
      "This property already has a current membership. Archive it before completing another agreement.",
    );
  }

  const portalAccessToken =
    (currentMembership.data?.portal_access_token as string | null) ??
    generatePortalAccessToken();
  const pricing = buildMembershipPricingFields({
    tier: packet.agreement_tier,
    visitPrice: packet.recurring_visit_price_cents / 100,
    planName: planNameForAgreement(packet.agreement_tier),
    annualRate: packet.annualized_value_cents / 100,
    variableVisitPricing: presentation.planMode === "custom",
  });
  const founding = resolveFoundingMemberFields(input.signedAt);
  let membershipId = currentMembership.data?.id as string | undefined;
  if (!membershipId) {
    const membershipResult = await supabase
      .from("memberships")
      .insert({
        homeowner_id: homeownerId,
        property_id: propertyId,
        presentation_id: presentation.id,
        plan_id: planId(),
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
        payment_rail: packet.payment_rail,
        manual_payment_approved_at: packet.manual_payment_approved_at,
        manual_payment_approved_by: packet.manual_payment_approved_by,
      })
      .select("id")
      .single();
    if (membershipResult.error || !membershipResult.data?.id) {
      throw new Error(
        `Failed to create the membership: ${membershipResult.error?.message ?? "unknown"}`,
      );
    }
    membershipId = membershipResult.data.id as string;
  }

  const signedPresentation: PresentationData = {
    ...presentation,
    clientName: snapshot.customer.name,
    clientEmail: snapshot.customer.email,
    clientPhone: snapshot.customer.phone ?? "",
    clientAddress: snapshot.property.fullAddress,
    homeSqft: snapshot.property.squareFeet ?? 0,
    twoStory: snapshot.property.twoStory,
    tier: snapshot.plan.tier,
    planMode: "custom",
    includeInterior: snapshot.plan.visits.every(
      (visit) => visit.interiorWindows === "included",
    ),
    includeScreens: snapshot.plan.visits.every(
      (visit) => visit.screens === "included",
    ),
    carePlan: {
      version: PRESENTATION_CARE_PLAN_VERSION,
      tier: snapshot.plan.tier,
      summary: snapshot.plan.summary,
      customerChoiceNote: snapshot.plan.customerChoiceNote,
      servicePrices: { ...DEFAULT_CARE_PLAN_SERVICE_PRICES },
      visits: snapshot.plan.visits.map((visit, index) => ({
        id: `visit_${index + 1}`,
        label: visit.label,
        timing: visit.timing,
        exteriorWindows: visit.exteriorWindows ?? "included",
        interiorWindows: visit.interiorWindows,
        screens: visit.screens,
        cobwebRemoval: visit.cobwebRemoval,
        solarPanels: visit.solarPanels ?? "not_included",
        pressureWashing: visit.pressureWashing ?? "not_included",
        notes: visit.notes,
        priceOverride: visit.priceCents / 100,
      })),
    },
    monthlyRate: packet.recurring_visit_price_cents / 100,
    overrideTier: packet.agreement_tier,
    visitRateOverrides: {
      ...presentation.visitRateOverrides,
      [packet.agreement_tier]: packet.recurring_visit_price_cents / 100,
    },
    annualRate: packet.annualized_value_cents / 100,
  };
  const portalPlan = buildPortalHomeCarePlanFromPresentation({
    presentation: signedPresentation,
    homeownerSlug,
    propertySlug,
    planName: pricing.planName,
    agreementTier: packet.agreement_tier,
    visitPrice: pricing.visitPrice,
  });
  await persistPortalHomeCarePlan(supabase, {
    homeownerId,
    propertyId,
    homeownerSlug,
    propertySlug,
    plan: portalPlan,
  });

  let agreementPdf = input.combinedPdf;
  let storedSignature: Awaited<ReturnType<typeof storeSignatureImage>> = null;
  if (signatureProvider === "homeatlas_native") {
    const signatureDataUrl = input.signatureDataUrl as string;
    agreementPdf = await generateSignedPDF({
      memberName: snapshot.signer?.name ?? snapshot.customer.name,
      signedAt: input.signedAt,
      signatureDataUrl,
      tier: pricing.planName,
      agreementTier: packet.agreement_tier,
      propertyName: address.propertyName,
      monthlyPrice: packet.recurring_visit_price_cents / 100,
      homeSqft: snapshot.property.squareFeet ?? undefined,
      twoStory: snapshot.property.twoStory,
      includeScreens: snapshot.plan.visits.every(
        (visit) => visit.screens === "included",
      ),
      includeInterior: snapshot.plan.visits.every(
        (visit) => visit.interiorWindows === "included",
      ),
      carePlan: signedPresentation.carePlan,
      carePlanPricing: {
        baseVisitPrice: packet.recurring_visit_price_cents / 100,
        annualTotal: packet.annualized_value_cents / 100,
        averageVisitPrice:
          packet.annualized_value_cents / 100 / snapshot.plan.visitsPerYear,
        visits: snapshot.plan.visits.map((visit, index) => ({
          id: `visit_${index + 1}`,
          label: visit.label,
          total: visit.priceCents / 100,
          usedOverride: true,
        })),
      },
      annualPrice: packet.annualized_value_cents / 100,
    });
    storedSignature = await storeSignatureImage(
      signatureDataUrl,
      `native/${safeFileSegment(packet.id)}-signature-${Date.now()}.png`,
    );
  }
  if (!agreementPdf) {
    throw new Error("The signed agreement PDF evidence is missing.");
  }

  const timestamp = Date.now();
  const baseName = safeFileSegment(`${packet.id}-${externalSignatureId}`);
  const storedAgreement = await storeSignedPdf(
    agreementPdf,
    `${signatureProvider}/${baseName}-agreement-${timestamp}.pdf`,
  );
  const storedCertificate = input.certificatePdf
    ? await storeSignedPdf(
        input.certificatePdf,
        `${signatureProvider}/${baseName}-certificate-${timestamp}.pdf`,
      )
    : null;
  if (
    storedAgreement.backend !== "supabase" ||
    (storedCertificate && storedCertificate.backend !== "supabase")
  ) {
    throw new Error(
      "The signed agreement evidence could not be stored in the private agreement vault.",
    );
  }

  const termsHash = manualPayment ? null : membershipBillingTermsHash();
  const agreementResult = await supabase
    .from("signed_agreements")
    .insert({
      homeowner_id: homeownerId,
      property_id: propertyId,
      membership_id: membershipId,
      presentation_id: presentation.id,
      homeowner_slug: homeownerSlug,
      property_slug: propertySlug,
      homeowner_name: snapshot.customer.name,
      plan_id: planId(),
      plan_name: pricing.planName,
      signature_method:
        signatureProvider === "docusign" ? "docusign_remote" : "drawn",
      signer_name: snapshot.signer?.name ?? snapshot.customer.name,
      signature_image_url:
        signatureProvider === "homeatlas_native"
          ? storedSignature?.storageRef ?? input.signatureDataUrl
          : null,
      signature_image_storage_path: storedSignature?.storagePath ?? null,
      typed_text: null,
      signed_at: input.signedAt,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
      agreement_pdf_url: storedAgreement.url,
      status: "complete",
      storage_backend: "supabase",
      billing_authorization_version: manualPayment
        ? null
        : MEMBERSHIP_BILLING_AUTHORIZATION_VERSION,
      billing_authorized_at: manualPayment ? null : input.signedAt,
      authorized_visit_price_cents: manualPayment
        ? null
        : packet.recurring_visit_price_cents,
      billing_terms_hash: termsHash,
      payment_rail: packet.payment_rail,
      external_signature_provider: signatureProvider,
      external_envelope_id: externalSignatureId,
      msa_version: versions.msa.version,
      service_agreement_version: versions.service.version,
      completion_certificate_url: storedCertificate?.url ?? null,
      document_snapshot: snapshot,
    })
    .select("id")
    .single();
  if (agreementResult.error || !agreementResult.data?.id) {
    throw new Error(
      `The signature evidence was stored but the agreement record failed: ${agreementResult.error?.message ?? "unknown"}`,
    );
  }
  const agreementId = agreementResult.data.id as string;

  if (!manualPayment) {
    const authorizationEvent = await supabase
      .from("membership_billing_authorization_events")
      .upsert(
        {
          membership_id: membershipId,
          agreement_id: agreementId,
          authorization_version: MEMBERSHIP_BILLING_AUTHORIZATION_VERSION,
          authorized_visit_price_cents: packet.recurring_visit_price_cents,
          billing_terms_hash: termsHash,
          actor:
            signatureProvider === "docusign"
              ? "customer_docusign_signature"
              : "customer_homeatlas_signature",
          evidence_source: "customer_signature",
          occurred_at: input.signedAt,
        },
        {
          onConflict:
            "membership_id,agreement_id,authorization_version,evidence_source",
          ignoreDuplicates: true,
        },
      );
    if (authorizationEvent.error) {
      throw new Error(authorizationEvent.error.message);
    }
  }

  const membershipLink = await supabase
    .from("memberships")
    .update({
      agreement_id: agreementId,
      status: manualPayment ? "active" : "pending_payment",
      ...enrollmentMembershipBillingState({
        manualPayment,
        pausedAt: packet.manual_payment_approved_at ?? input.signedAt,
      }),
      payment_rail: packet.payment_rail,
      manual_payment_approved_at: packet.manual_payment_approved_at,
      manual_payment_approved_by: packet.manual_payment_approved_by,
    })
    .eq("id", membershipId);
  if (membershipLink.error) throw new Error(membershipLink.error.message);

  const overrides = normalizeVisitRateOverrides(presentation);
  const presentationUpdate = await supabase
    .from("presentations")
    .update({
      status: "signed",
      signed_at: input.signedAt,
      agreement_id: agreementId,
      homeowner_id: homeownerId,
      property_id: propertyId,
      membership_id: membershipId,
      onboarding_status: manualPayment ? "complete" : "pending_payment",
      tier: packet.agreement_tier,
      annual_rate: pricing.annualRate,
      visit_rate_overrides: overrides,
      plan_mode: "custom",
      care_plan: signedPresentation.carePlan,
      ...legacyOverrideFieldsForTier(overrides, packet.agreement_tier),
    })
    .eq("id", presentation.id);
  if (presentationUpdate.error) throw new Error(presentationUpdate.error.message);

  const salesAttribution = await recordRemoteSalesAttribution({
    packetId: packet.id,
    presentationId: presentation.id,
    membershipId,
    agreementId,
    signedAt: input.signedAt,
  });

  if (presentation.clientEmail) {
    import("@/lib/referrals/repository")
      .then(({ markReferralConverted }) =>
        markReferralConverted({
          email: presentation.clientEmail,
          membershipId,
        }),
      )
      .catch(() => {});
  }

  return {
    packetId: packet.id,
    agreementId,
    membershipId,
    homeownerId,
    propertyId,
    portalUrl: buildPortalAccessUrl(portalAccessToken),
    alreadyCompleted: false,
    salesAttribution,
  };
}
