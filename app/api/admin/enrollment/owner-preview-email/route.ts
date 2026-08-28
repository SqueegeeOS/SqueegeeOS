import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import { sendResendEmail } from "@/lib/communications/providers/resend-email";
import { buildSignatureInvitationEmail } from "@/lib/enrollment/signature-invitation-email";
import { getEnrollmentRecipientGate } from "@/lib/enrollment/release-control";
import type { EnrollmentDocumentSnapshot } from "@/lib/enrollment/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function rehearsalRecipient(): string | null {
  return process.env.HOMEATLAS_ENROLLMENT_REHEARSAL_EMAIL?.trim() || null;
}

function ownerPreviewSnapshot(recipient: string): EnrollmentDocumentSnapshot {
  return {
    schemaVersion: 2,
    presentationId: "owner-preview-riley",
    customer: {
      name: "Michael and Allegra Riley",
      email: recipient,
      phone: null,
    },
    signer: {
      name: "Michael Riley",
      email: recipient,
      phone: null,
    },
    property: {
      fullAddress: "Riley Residence",
      squareFeet: null,
      twoStory: false,
    },
    plan: {
      tier: "quarterly",
      tierLabel: "Quarterly Solar + Exterior Care Plan",
      cadence: "4 visits per year",
      visitsPerYear: 4,
      firstVisitPriceCents: 30000,
      recurringVisitPriceCents: 30000,
      annualizedValueCents: 160000,
      addonDiscountPercent: 0,
      summary:
        "Four planned visits alternating solar-only care with solar, exterior windows, and standard window screens.",
      customerChoiceNote:
        "Optional services are separate and are added only when requested.",
      visits: [],
    },
    payment: {
      rail: "manual_cash_check",
      arrangementSummary:
        "Cash or check account. No card setup or automatic card billing.",
    },
    disclosures: {
      salesContext: "remote",
      homeSolicitationNoticeDays: null,
      renewalSummary: "",
      cancellationSummary: "",
      rateChangeSummary: "",
      billingSummary: "",
      billingConsent: "",
    },
    createdAt: new Date().toISOString(),
  };
}

export async function POST(request: Request) {
  if (!authorizeAdminRequest(request.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const recipient = rehearsalRecipient();
  if (!recipient) {
    return NextResponse.json(
      { error: "The owner rehearsal inbox is not configured." },
      { status: 409 },
    );
  }
  const gate = getEnrollmentRecipientGate(recipient);
  if (!gate.allowed) {
    return NextResponse.json({ error: gate.detail }, { status: 409 });
  }

  const previewToken = process.env.HOMEATLAS_ENROLLMENT_PREVIEW_TOKEN?.trim();
  if (!previewToken) {
    return NextResponse.json(
      { error: "The safe owner preview link is not configured." },
      { status: 409 },
    );
  }

  const invitation = buildSignatureInvitationEmail({
    snapshot: ownerPreviewSnapshot(recipient),
    enrollmentUrl: `${new URL(request.url).origin}/enroll/preview/${encodeURIComponent(previewToken)}`,
    signatureProvider: "homeatlas_native",
  });
  const result = await sendResendEmail({
    to: recipient,
    replyTo:
      process.env.HOMEATLAS_LEGAL_NOTICE_EMAIL?.trim() || recipient,
    subject: invitation.subject,
    html: invitation.html,
    text: invitation.text,
    idempotencyKey: "homeatlas-riley-owner-preview-premium-native-v2",
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: `The owner preview email was not accepted: ${result.errorCode}` },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    status: result.status,
    recipientHint: gate.detail,
  });
}
