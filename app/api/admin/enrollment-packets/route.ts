import { NextResponse } from "next/server";
import { authorizeSalesPresentationRequest } from "@/lib/sales/sales-access";
import { getPresentation } from "@/lib/presentations/repository";
import {
  EnrollmentNotReadyError,
  sendEnrollmentPacket,
} from "@/lib/enrollment/send-packet";
import type { EnrollmentSalesContext } from "@/lib/enrollment/types";
import type { SqueegeeKingTierId } from "@/lib/membership/tier-config";

export const runtime = "nodejs";
export const maxDuration = 60;

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
function positivePrice(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 1_000_000
    ? Math.round(parsed * 100) / 100
    : null;
}

function tier(value: unknown): SqueegeeKingTierId | null {
  return value === "biannual" || value === "triannual" || value === "quarterly"
    ? value
    : null;
}

function salesContext(value: unknown): EnrollmentSalesContext | null {
  return value === "customer_home" ||
    value === "business_premises" ||
    value === "remote" ||
    value === "other"
    ? value
    : null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const presentationId =
      typeof body.presentationId === "string" ? body.presentationId.trim() : "";
    if (
      !presentationId ||
      !(await authorizeSalesPresentationRequest(request.headers, presentationId))
    ) {
      return unauthorized();
    }
    const selectedTier = tier(body.tier);
    const firstVisitPrice = positivePrice(body.firstVisitPrice);
    const recurringVisitPrice = positivePrice(body.recurringVisitPrice);
    const annualizedValue = positivePrice(body.annualizedValue);
    const context = salesContext(body.salesContext);
    const noticeDays =
      body.homeSolicitationNoticeDays === 3 ||
      body.homeSolicitationNoticeDays === 5
        ? body.homeSolicitationNoticeDays
        : null;
    if (
      !presentationId ||
      !selectedTier ||
      !firstVisitPrice ||
      !recurringVisitPrice ||
      !annualizedValue ||
      !context
    ) {
      return NextResponse.json(
        { error: "Complete the customer, plan, rates, and sales context first." },
        { status: 400 },
      );
    }

    const presentation = await getPresentation(presentationId);
    if (!presentation) {
      return NextResponse.json({ error: "Presentation not found." }, { status: 404 });
    }
    if (presentation.status === "signed" || presentation.agreementId) {
      return NextResponse.json(
        { error: "This presentation already has a signed agreement." },
        { status: 409 },
      );
    }

    const result = await sendEnrollmentPacket({
      presentation,
      tier: selectedTier,
      firstVisitPrice,
      recurringVisitPrice,
      annualizedValue,
      salesContext: context,
      homeSolicitationNoticeDays: context === "customer_home" ? noticeDays : null,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof EnrollmentNotReadyError) {
      return NextResponse.json(
        { error: error.message, readiness: error.readiness },
        { status: 409 },
      );
    }
    const message =
      error instanceof Error ? error.message : "Enrollment handoff failed.";
    console.error("[enrollment-packets] send failed", { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
