import { NextRequest, NextResponse } from "next/server";
import { processSignAgreement } from "@/lib/agreement/process-sign-agreement";
import { getPresentation, patchPresentation } from "@/lib/presentations/repository";
import { slugifyPresentation } from "@/lib/presentations/calculations";
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

function tierToPlanId(_tier: string): MembershipPlanId {
  return "preferred";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isSignatureDataUrl(value: string): boolean {
  return /^data:image\/png;base64,/i.test(value);
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
      homeSqft,
      twoStory,
      includeScreens,
      includeInterior,
      quoteSnapshot,
    } = body;

    if (presentationId) {
      const presentation = await getPresentation(presentationId);
      if (!presentation) {
        return NextResponse.json(
          { error: "Presentation not found" },
          { status: 404 },
        );
      }

      memberName = memberName || presentation.clientName;
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

    if (presentationId && !isOneTime) {
      try {
        const presentationPatch: Parameters<typeof patchPresentation>[1] = {
          status: "signed",
          signedAt,
          tier: resolvedTier ?? "quarterly",
        };
        if (isUuid(result.agreementId)) {
          presentationPatch.agreementId = result.agreementId;
        }
        await patchPresentation(presentationId, presentationPatch);
      } catch (patchError) {
        console.warn(
          "[sign-agreement] Presentation patch failed after signing:",
          patchError,
        );
      }
    }

    return NextResponse.json({
      pdfUrl: result.pdfUrl,
      agreementId: result.agreementId,
      emailSent: result.emailSent,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to process agreement";
    console.error("[sign-agreement] error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
