import { describe, expect, it } from "vitest";
import type { EnrollmentReadiness } from "./readiness";
import type { EnrollmentDocumentSnapshot } from "./types";
import { buildEnrollmentPreflightReport } from "./preflight";

function snapshot(input: {
  paymentRail?: "stripe_card" | "manual_cash_check";
  createdAt?: string;
} = {}): EnrollmentDocumentSnapshot {
  return {
    schemaVersion: 2,
    presentationId: "00000000-0000-4000-8000-000000000086",
    customer: {
      name: "Business Rehearsal",
      email: "owner@example.com",
      phone: null,
    },
    property: {
      fullAddress: "100 Test Way, Chico, CA 95928",
      squareFeet: 2200,
      twoStory: false,
    },
    plan: {
      tier: "quarterly",
      tierLabel: "Quarterly Care",
      cadence: "Every 3 months",
      visitsPerYear: 4,
      firstVisitPriceCents: 27_500,
      recurringVisitPriceCents: 20_000,
      annualizedValueCents: 87_500,
      addonDiscountPercent: 0,
      summary: "Exterior every visit, annual interior.",
      customerChoiceNote: "Screens optional.",
      visits: [],
    },
    payment: {
      rail: input.paymentRail ?? "stripe_card",
      arrangementSummary: "Safe provider handoff.",
    },
    disclosures: {
      salesContext: "remote",
      homeSolicitationNoticeDays: null,
      renewalSummary: "Renewal summary",
      cancellationSummary: "Cancellation summary",
      rateChangeSummary: "Rate change summary",
      billingSummary: "Billing summary",
      billingConsent: "Billing consent",
    },
    createdAt: input.createdAt ?? "2026-08-17T03:15:00.000Z",
  };
}

function readiness(input: {
  stripeReady?: boolean;
  allReady?: boolean;
} = {}): EnrollmentReadiness {
  const allReady = input.allReady ?? true;
  const stripeReady = input.stripeReady ?? allReady;
  const approved = {
    msa: {
      id: "00000000-0000-4000-8000-000000000001",
      documentKind: "master_service_agreement" as const,
      version: "ca-msa-v1",
      contentSha256: "a".repeat(64),
      approvedAt: "2026-08-17T03:00:00.000Z",
      approvedBy: "HomeAtlas owner",
    },
    serviceQuote: {
      id: "00000000-0000-4000-8000-000000000002",
      documentKind: "service_quote_agreement" as const,
      version: "ca-service-quote-v1",
      contentSha256: "b".repeat(64),
      approvedAt: "2026-08-17T03:00:00.000Z",
      approvedBy: "HomeAtlas owner",
    },
  };
  const checks: EnrollmentReadiness["checks"] = [
    "database",
    "legal_documents",
    "legal_identity",
    "release_control",
    "docusign",
    "email",
  ].map((id) => ({
    id: id as EnrollmentReadiness["checks"][number]["id"],
    label: id,
    ready: allReady,
    detail: allReady ? "Ready" : "Waiting",
    missing: allReady ? [] : [id],
  }));
  checks.push({
    id: "stripe",
    label: "stripe",
    ready: stripeReady,
    detail: stripeReady ? "Ready" : "Waiting",
    missing: stripeReady ? [] : ["stripe"],
  });
  return {
    readyToSend: checks.every((check) => check.ready),
    checks,
    approvedVersions: allReady ? approved : { msa: null, serviceQuote: null },
    legalIdentity: allReady
      ? {
          companyName: "SqueegeeKing LLC",
          businessAddress: "100 Test Way",
          noticeEmail: "owner@example.com",
          phone: "5305550100",
        }
      : null,
    releaseControl: {
      mode: "rehearsal",
      ready: allReady,
      rehearsalRecipientConfigured: allReady,
      rehearsalRecipientHint: allReady ? "ow***@example.com" : null,
      rehearsalConfirmed: false,
      detail: allReady ? "Ready" : "Waiting",
      missing: allReady ? [] : ["HOMEATLAS_ENROLLMENT_REHEARSAL_EMAIL"],
    },
  };
}

const allowedRecipient = {
  allowed: true,
  mode: "rehearsal" as const,
  detail: "Business rehearsal recipient matches.",
};

describe("no-send enrollment preflight", () => {
  it("proves a ready deal without creating any side effect", () => {
    const report = buildEnrollmentPreflightReport({
      snapshot: snapshot(),
      readiness: readiness(),
      actorKind: "admin",
      presentationCanEnroll: true,
      existingPacketStatus: null,
      recipientGate: allowedRecipient,
    });

    expect(report.mode).toBe("no_side_effects");
    expect(report.readyToSend).toBe(true);
    expect(report.snapshotSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.values(report.guarantees).every((value) => value === false)).toBe(
      true,
    );
  });

  it("keeps the fingerprint stable when only the rehearsal timestamp changes", () => {
    const first = buildEnrollmentPreflightReport({
      snapshot: snapshot({ createdAt: "2026-08-17T03:15:00.000Z" }),
      readiness: readiness(),
      actorKind: "admin",
      presentationCanEnroll: true,
      existingPacketStatus: null,
      recipientGate: allowedRecipient,
    });
    const second = buildEnrollmentPreflightReport({
      snapshot: snapshot({ createdAt: "2026-08-17T04:15:00.000Z" }),
      readiness: readiness(),
      actorKind: "admin",
      presentationCanEnroll: true,
      existingPacketStatus: null,
      recipientGate: allowedRecipient,
    });

    expect(second.snapshotSha256).toBe(first.snapshotSha256);
  });

  it("does not require DocuSign for the native HomeAtlas signature box", () => {
    const nativeReadiness = readiness();
    const docusign = nativeReadiness.checks.find(
      (check) => check.id === "docusign",
    )!;
    docusign.ready = false;
    docusign.detail = "DocuSign is not configured.";
    docusign.missing = ["DOCUSIGN_INTEGRATION_KEY"];

    const report = buildEnrollmentPreflightReport({
      snapshot: snapshot(),
      readiness: nativeReadiness,
      actorKind: "admin",
      presentationCanEnroll: true,
      existingPacketStatus: null,
      recipientGate: allowedRecipient,
      signatureProvider: "homeatlas_native",
    });

    expect(report.readyToSend).toBe(true);
    expect(report.checks.find((check) => check.id === "docusign")).toMatchObject({
      ready: true,
      detail: "Not required for the private HomeAtlas signature box.",
    });
  });

  it("ignores Stripe only for owner-approved cash/check and still blocks a rep", () => {
    const ownerReport = buildEnrollmentPreflightReport({
      snapshot: snapshot({ paymentRail: "manual_cash_check" }),
      readiness: readiness({ stripeReady: false }),
      actorKind: "admin",
      presentationCanEnroll: true,
      existingPacketStatus: null,
      recipientGate: allowedRecipient,
    });
    const repReport = buildEnrollmentPreflightReport({
      snapshot: snapshot({ paymentRail: "manual_cash_check" }),
      readiness: readiness({ stripeReady: false }),
      actorKind: "sales_rep",
      presentationCanEnroll: true,
      existingPacketStatus: null,
      recipientGate: allowedRecipient,
    });

    expect(ownerReport.readyToSend).toBe(true);
    expect(
      ownerReport.checks.find((check) => check.id === "stripe"),
    ).toMatchObject({ ready: true });
    expect(repReport.readyToSend).toBe(false);
    expect(
      repReport.checks.find((check) => check.id === "operator_authority"),
    ).toMatchObject({ ready: false });
  });

  it("surfaces legal/provider blockers and an existing packet", () => {
    const report = buildEnrollmentPreflightReport({
      snapshot: snapshot(),
      readiness: readiness({ allReady: false }),
      actorKind: "admin",
      presentationCanEnroll: true,
      existingPacketStatus: "signature_sent",
      recipientGate: allowedRecipient,
    });

    expect(report.readyToSend).toBe(false);
    expect(report.checks.find((check) => check.id === "existing_packet")).toMatchObject(
      { ready: false },
    );
    expect(report.checks.find((check) => check.id === "legal_documents")).toMatchObject(
      { ready: false },
    );
  });

  it("allows only the draft and needs-attention packet states the send path can reprepare", () => {
    const draftReport = buildEnrollmentPreflightReport({
      snapshot: snapshot(),
      readiness: readiness(),
      actorKind: "admin",
      presentationCanEnroll: true,
      existingPacketStatus: "draft",
      recipientGate: allowedRecipient,
    });
    const completedReport = buildEnrollmentPreflightReport({
      snapshot: snapshot(),
      readiness: readiness(),
      actorKind: "admin",
      presentationCanEnroll: true,
      existingPacketStatus: "signature_complete",
      recipientGate: allowedRecipient,
    });

    expect(draftReport.readyToSend).toBe(true);
    expect(completedReport.readyToSend).toBe(false);
  });

  it("blocks a real customer while the system is locked to rehearsal", () => {
    const report = buildEnrollmentPreflightReport({
      snapshot: snapshot(),
      readiness: readiness(),
      actorKind: "admin",
      presentationCanEnroll: true,
      existingPacketStatus: null,
      recipientGate: {
        allowed: false,
        mode: "rehearsal",
        detail: "Use only the business-owned rehearsal address.",
      },
    });

    expect(report.readyToSend).toBe(false);
    expect(report.checks.find((check) => check.id === "recipient_control")).toMatchObject(
      { ready: false },
    );
  });
});
