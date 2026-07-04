import { NextRequest, NextResponse } from "next/server";
import { processSignAgreement } from "@/lib/agreement/process-sign-agreement";
import { getPresentation, patchPresentation } from "@/lib/presentations/repository";
import { slugifyPresentation } from "@/lib/presentations/calculations";
import {
  normalizeToSqueegeeKingTier,
  planNameForAgreement,
} from "@/lib/membership/tier-config";
import type { MembershipPlanId } from "@/lib/membership/types";

function tierToPlanId(_tier: string): MembershipPlanId {
  return "preferred";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let {
      memberName,
      memberEmail,
      homeownerSlug,
      propertySlug,
      propertyName,
      planId,
      planName,
      signatureDataUrl,
      signedAt,
      monthlyPrice,
      presentationId,
      agreementTier,
    } = body;

    if (presentationId && !memberName) {
      const presentation = await getPresentation(presentationId);
      if (!presentation) {
        return NextResponse.json(
          { error: "Presentation not found" },
          { status: 404 },
        );
      }
      memberName = presentation.clientName;
      memberEmail = memberEmail || presentation.clientEmail;
      homeownerSlug =
        homeownerSlug || slugifyPresentation(presentation.clientName) || "client";
      propertySlug =
        propertySlug ||
        slugifyPresentation(presentation.clientAddress) ||
        "property";
      propertyName =
        propertyName || presentation.clientAddress || presentation.clientName;
      agreementTier = agreementTier ?? presentation.tier;
      planId = planId || tierToPlanId(agreementTier);
      planName =
        planName || planNameForAgreement(normalizeToSqueegeeKingTier(agreementTier));
      monthlyPrice = monthlyPrice ?? presentation.monthlyRate;
    }

    const resolvedTier = normalizeToSqueegeeKingTier(agreementTier ?? "quarterly");

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

    if (!signatureDataUrl.startsWith("data:image/png;base64,")) {
      return NextResponse.json(
        { error: "Signature must be a PNG data URL" },
        { status: 400 },
      );
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
      monthlyPrice:
        typeof monthlyPrice === "number" ? monthlyPrice : undefined,
      agreementTier: resolvedTier,
      ipAddress: req.headers.get("x-forwarded-for"),
      userAgent: req.headers.get("user-agent"),
    });

    if (presentationId) {
      await patchPresentation(presentationId, {
        status: "signed",
        signedAt,
        agreementId: result.agreementId,
        tier: resolvedTier,
      });
    }

    return NextResponse.json({
      pdfUrl: result.pdfUrl,
      agreementId: result.agreementId,
      emailSent: result.emailSent,
    });
  } catch (error) {
    console.error("[sign-agreement] error:", error);
    return NextResponse.json(
      { error: "Failed to process agreement" },
      { status: 500 },
    );
  }
}
