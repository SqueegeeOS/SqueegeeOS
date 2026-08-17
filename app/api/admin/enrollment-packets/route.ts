import { NextResponse } from "next/server";
import { authorizeSalesPresentationRequest } from "@/lib/sales/sales-access";
import { getPresentation } from "@/lib/presentations/repository";
import {
  EnrollmentNotReadyError,
  sendEnrollmentPacket,
} from "@/lib/enrollment/send-packet";
import { loadEnrollmentPacketStatus } from "@/lib/enrollment/packet-status-server";
import { parseEnrollmentSubmission } from "@/lib/enrollment/submission";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: Request) {
  const presentationId = new URL(request.url).searchParams
    .get("presentationId")
    ?.trim();
  if (
    !presentationId ||
    !(await authorizeSalesPresentationRequest(request.headers, presentationId))
  ) {
    return unauthorized();
  }

  try {
    const packet = await loadEnrollmentPacketStatus(presentationId);
    return NextResponse.json(
      { packet },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "The secure handoff status could not be loaded.";
    console.error("[enrollment-packets] status load failed", { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
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
    if (!presentationId || !actor) {
      return unauthorized();
    }
    if (!parsed.ok) {
      return NextResponse.json(
        { error: "Complete the customer, plan, rates, and sales context first." },
        { status: 400 },
      );
    }

    if (
      parsed.value.paymentRail === "manual_cash_check" &&
      actor.kind !== "admin"
    ) {
      return NextResponse.json(
        {
          error:
            "Cash/check accounts require HomeAtlas owner approval. Save the presentation and ask HQ to send this packet.",
        },
        { status: 403 },
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
      tier: parsed.value.tier,
      firstVisitPrice: parsed.value.firstVisitPrice,
      recurringVisitPrice: parsed.value.recurringVisitPrice,
      annualizedValue: parsed.value.annualizedValue,
      salesContext: parsed.value.salesContext,
      homeSolicitationNoticeDays:
        parsed.value.homeSolicitationNoticeDays,
      paymentRail: parsed.value.paymentRail,
      actor:
        actor.kind === "admin"
          ? "homeatlas_hq"
          : `sales_rep:${actor.repSlug}`,
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
