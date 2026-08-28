import { NextResponse } from "next/server";
import { authorizeSalesPresentationRequest } from "@/lib/sales/sales-access";
import { getPresentation } from "@/lib/presentations/repository";
import { buildEnrollmentDocumentSnapshot } from "@/lib/enrollment/document-snapshot";
import { loadEnrollmentPacketStatus } from "@/lib/enrollment/packet-status-server";
import { buildEnrollmentPreflightReport } from "@/lib/enrollment/preflight";
import { getEnrollmentReadiness } from "@/lib/enrollment/readiness";
import { parseEnrollmentSubmission } from "@/lib/enrollment/submission";
import { getEnrollmentRecipientGate } from "@/lib/enrollment/release-control";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = parseEnrollmentSubmission(body);
    const presentationId = parsed.ok
      ? parsed.value.presentationId
      : parsed.presentationId;
    const actor = presentationId
      ? await authorizeSalesPresentationRequest(request.headers, presentationId)
      : null;
    if (!presentationId || !actor) return unauthorized();
    if (!parsed.ok) {
      return NextResponse.json(
        { error: "Complete the customer, plan, rates, and sales context first." },
        { status: 400 },
      );
    }

    const presentation = await getPresentation(presentationId);
    if (!presentation) {
      return NextResponse.json(
        { error: "Presentation not found." },
        { status: 404 },
      );
    }

    const snapshot = buildEnrollmentDocumentSnapshot({
      presentation,
      tier: parsed.value.tier,
      firstVisitPrice: parsed.value.firstVisitPrice,
      recurringVisitPrice: parsed.value.recurringVisitPrice,
      annualizedValue: parsed.value.annualizedValue,
      salesContext: parsed.value.salesContext,
      homeSolicitationNoticeDays:
        parsed.value.homeSolicitationNoticeDays,
      paymentRail: parsed.value.paymentRail,
    });
    const [readiness, existingPacket] = await Promise.all([
      getEnrollmentReadiness(),
      loadEnrollmentPacketStatus(presentationId),
    ]);
    const report = buildEnrollmentPreflightReport({
      snapshot,
      readiness,
      actorKind: actor.kind,
      presentationCanEnroll:
        presentation.status !== "signed" && !presentation.agreementId,
      existingPacketStatus: existingPacket?.status ?? null,
      recipientGate: getEnrollmentRecipientGate(snapshot.customer.email),
      signatureProvider: parsed.value.signatureProvider,
    });

    return NextResponse.json(
      { report },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "The no-send enrollment rehearsal failed.";
    console.error("[enrollment-preflight] check failed", { message });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
