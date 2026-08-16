import { NextRequest, NextResponse } from "next/server";
import { processSignAgreement } from "@/lib/agreement/process-sign-agreement";
import {
  completeSignOnboarding,
  SignOnboardingError,
} from "@/lib/membership/complete-sign-onboarding";
import { getPresentation } from "@/lib/presentations/repository";
import {
  scopedPresentationSlug,
  tierVisitPriceForPresentation,
} from "@/lib/presentations/calculations";
import {
  normalizeToSqueegeeKingTier,
  planNameForAgreement,
} from "@/lib/membership/tier-config";
import {
  agreementKindForPlan,
  isOneTimePlanId,
  planNameForOneTimeAgreement,
} from "@/lib/agreement/one-time-agreement";
import type { MembershipPlanId } from "@/lib/membership/types";
import { isCarePlanQuoteSnapshot } from "@/lib/presentations/quote-snapshot";
import type { PresentationQuoteSnapshot } from "@/lib/presentations/quote-snapshot";
import { resolveMemberEmail } from "@/lib/agreement/resolve-member-email";
import {
  authorizeSalesRequest,
  salesActorOwnsPresentation,
} from "@/lib/sales/sales-access";
import {
  hasCompleteClientAddress,
  parseClientAddress,
} from "@/lib/presentations/parse-client-address";
import { recordSignedMembershipAttribution } from "@/lib/sales/signed-attribution-server";

function tierToPlanId(): MembershipPlanId {
  return "preferred";
}

function isSignatureDataUrl(value: string): boolean {
  return /^data:image\/png;base64,/i.test(value);
}

export async function POST(req: NextRequest) {
  const actor = await authorizeSalesRequest(req.headers);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    if (
      actor.kind === "sales_rep" &&
      (typeof body.presentationId !== "string" ||
        !(await salesActorOwnsPresentation(actor, body.presentationId)))
    ) {
      return NextResponse.json(
        { error: "This phone pass can sign only its own presentation." },
        { status: 403 },
      );
    }
    const { signatureDataUrl, signedAt, presentationId, ...mutableFields } = body;
    let {
      memberName,
      memberEmail,
      homeownerSlug,
      propertySlug,
      propertyName,
      planId,
      planName,
      monthlyPrice,
      agreementTier,
      homeSqft,
      twoStory,
      includeScreens,
      includeInterior,
      quoteSnapshot,
    } = mutableFields;

    let presentation = null;
    if (presentationId) {
      presentation = await getPresentation(presentationId);
      if (!presentation) {
        return NextResponse.json(
          { error: "Presentation not found" },
          { status: 404 },
        );
      }

      memberName = memberName || presentation.clientName;
      memberEmail = resolveMemberEmail(
        memberEmail,
        presentation.clientEmail,
      );
      // Do not accept mutable slugs as customer identity. Same-name customers
      // must never overwrite one another during an otherwise valid signing.
      homeownerSlug = scopedPresentationSlug(
        presentation.clientName,
        presentation.id,
        "client",
      );
      propertySlug = scopedPresentationSlug(
        presentation.clientAddress,
        presentation.id,
        "property",
      );
      propertyName =
        propertyName || presentation.clientAddress || presentation.clientName;
      agreementTier = agreementTier ?? presentation.tier;
      planId = planId || tierToPlanId();
      planName =
        planName || planNameForAgreement(normalizeToSqueegeeKingTier(agreementTier));
      const resolvedAgreementTier = normalizeToSqueegeeKingTier(agreementTier);
      monthlyPrice =
        monthlyPrice ??
        tierVisitPriceForPresentation(presentation, resolvedAgreementTier);
      homeSqft = homeSqft ?? presentation.homeSqft;
      twoStory = twoStory ?? presentation.twoStory;
      includeScreens = includeScreens ?? presentation.includeScreens;
      quoteSnapshot =
        quoteSnapshot ??
        (isCarePlanQuoteSnapshot(presentation.quoteSnapshot)
          ? presentation.quoteSnapshot
          : null);
      includeInterior =
        includeInterior ?? presentation.quoteSnapshot?.includeInterior ?? false;
    }

    const agreementKind = agreementKindForPlan(planId);
    const isOneTime = isOneTimePlanId(planId);

    if (isOneTime) {
      planName = planNameForOneTimeAgreement();
    }

    const resolvedTier = isOneTime
      ? undefined
      : normalizeToSqueegeeKingTier(agreementTier ?? "quarterly");

    if (
      presentation &&
      !isOneTime &&
      !hasCompleteClientAddress(
        parseClientAddress(presentation.clientAddress, presentation.clientName),
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Enter the complete service address as Street, City, ST ZIP before signing.",
        },
        { status: 422 },
      );
    }

    if (
      !memberName ||
      !homeownerSlug ||
      !propertySlug ||
      !propertyName ||
      !planId ||
      !planName ||
      !signatureDataUrl ||
      !signedAt
    ) {
      return NextResponse.json(
        { error: "Missing required agreement fields" },
        { status: 400 },
      );
    }

    if (!isSignatureDataUrl(signatureDataUrl)) {
      return NextResponse.json(
        { error: "Signature must be a PNG data URL" },
        { status: 400 },
      );
    }

    const visitPrice =
      typeof monthlyPrice === "number" ? monthlyPrice : undefined;

    if (presentation && !isOneTime && resolvedTier) {
      const result = await completeSignOnboarding({
        presentation,
        agreementTier: resolvedTier,
        visitPrice:
          visitPrice ??
          tierVisitPriceForPresentation(presentation, resolvedTier),
        signedAt,
        signatureDataUrl,
        planId: planId as MembershipPlanId,
        planName,
        homeownerSlug,
        propertySlug,
        memberEmail,
        quoteSnapshot: quoteSnapshot as PresentationQuoteSnapshot | null | undefined,
        ipAddress: req.headers.get("x-forwarded-for"),
        userAgent: req.headers.get("user-agent"),
      });

      // The agreement and membership are already authoritative at this point.
      // Sales reporting is intentionally non-fatal, and the unique membership
      // attribution makes retries safe when a client repeats the sign request.
      try {
        await recordSignedMembershipAttribution({
          presentationId: presentation.id,
          membershipId: result.membershipId,
          agreementId: result.agreementId,
          signedAt,
        });
      } catch (trackingError) {
        console.error(
          "[sign-agreement] nonfatal sales attribution failure",
          trackingError,
        );
      }

      return NextResponse.json({
        pdfUrl: result.pdfUrl,
        pdfStorageBackend: result.pdfStorageBackend,
        agreementId: result.agreementId,
        membershipId: result.membershipId,
        homeownerId: result.homeownerId,
        propertyId: result.propertyId,
        emailSent: result.emailSent,
        emailStatus: result.email.status,
        emailReason: result.email.reason ?? null,
        emailRecipient: result.email.recipient ?? null,
        emailDeliveryMode: result.email.deliveryMode ?? null,
        onboardingStatus: result.onboardingStatus,
        portalUrl: result.portalUrl,
      });
    }

    const result = await processSignAgreement({
      memberName,
      memberEmail,
      homeownerSlug,
      propertySlug,
      propertyName,
      planId: planId as MembershipPlanId,
      planName,
      signatureDataUrl,
      signedAt,
      monthlyPrice: visitPrice,
      agreementTier: resolvedTier,
      agreementKind,
      homeSqft: typeof homeSqft === "number" ? homeSqft : undefined,
      twoStory: typeof twoStory === "boolean" ? twoStory : undefined,
      includeScreens:
        typeof includeScreens === "boolean" ? includeScreens : undefined,
      includeInterior:
        typeof includeInterior === "boolean" ? includeInterior : undefined,
      quoteSnapshot: quoteSnapshot as PresentationQuoteSnapshot | null | undefined,
      ipAddress: req.headers.get("x-forwarded-for"),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({
      pdfUrl: result.pdfUrl,
      pdfStorageBackend: result.pdfStorageBackend,
      agreementId: result.agreementId,
      emailSent: result.emailSent,
      emailStatus: result.email.status,
      emailReason: result.email.reason ?? null,
      emailRecipient: result.email.recipient ?? null,
      emailDeliveryMode: result.email.deliveryMode ?? null,
    });
  } catch (error) {
    if (error instanceof SignOnboardingError) {
      const status = error.partial?.agreementId ? 207 : 500;
      return NextResponse.json(
        {
          error: error.message,
          membershipId: error.partial?.membershipId,
          agreementId: error.partial?.agreementId,
          onboardingStatus: error.partial?.onboardingStatus,
        },
        { status },
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to process agreement";
    console.error("[sign-agreement] error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
