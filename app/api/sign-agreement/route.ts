import { NextResponse } from "next/server";
import {
  parsePublicSignAgreementInput,
  SIGN_AGREEMENT_MAX_BODY_BYTES,
} from "@/lib/agreement/sign-agreement-input";
import {
  completeSignOnboarding,
  SignOnboardingConflictError,
  SignOnboardingError,
  SignOnboardingInputError,
} from "@/lib/membership/complete-sign-onboarding";
import {
  decodeAndValidateSignaturePng,
  InvalidSignaturePngError,
} from "@/lib/agreement/validate-signature-png";
import { readLimitedJsonObject } from "@/lib/http/read-limited-json-object";
import { getPresentationByCapability } from "@/lib/presentations/repository";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await readLimitedJsonObject(
    request,
    SIGN_AGREEMENT_MAX_BODY_BYTES,
  );
  const input = body ? parsePublicSignAgreementInput(body) : null;
  if (!input) {
    return NextResponse.json({ error: "Invalid signing request" }, { status: 400 });
  }

  try {
    await decodeAndValidateSignaturePng(input.signatureDataUrl);
    const presentation = await getPresentationByCapability(input.presentationId);
    if (!presentation) {
      return NextResponse.json({ error: "Presentation not found" }, { status: 404 });
    }

    const result = await completeSignOnboarding({
      presentation,
      agreementTier: input.agreementTier,
      signatureDataUrl: input.signatureDataUrl,
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    });

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
  } catch (error) {
    if (
      error instanceof InvalidSignaturePngError ||
      error instanceof SignOnboardingInputError
    ) {
      return NextResponse.json({ error: "Invalid signing request" }, { status: 400 });
    }
    if (error instanceof SignOnboardingConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
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

    console.error("[sign-agreement] failed:", error);
    return NextResponse.json(
      { error: "Failed to process agreement" },
      { status: 500 },
    );
  }
}
