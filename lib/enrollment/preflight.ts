import "server-only";

import { createHash } from "node:crypto";
import type { PaymentRail } from "@/lib/billing/payment-rail";
import type { EnrollmentReadiness } from "./readiness";
import { enrollmentReadyForPaymentRail } from "./readiness";
import type { EnrollmentDocumentSnapshot } from "./types";
import type { EnrollmentRecipientGate } from "./release-control";

export interface EnrollmentPreflightCheck {
  id: string;
  label: string;
  ready: boolean;
  detail: string;
}

export interface EnrollmentPreflightReport {
  mode: "no_side_effects";
  readyToSend: boolean;
  snapshotSha256: string;
  summary: {
    tierLabel: string;
    cadence: string;
    visitsPerYear: number;
    firstVisitPriceCents: number;
    recurringVisitPriceCents: number;
    annualizedValueCents: number;
    paymentRail: PaymentRail;
    salesContext: string;
    homeSolicitationNoticeDays: 3 | 5 | null;
    serviceAddressPresent: boolean;
    customerEmailPresent: boolean;
  };
  checks: EnrollmentPreflightCheck[];
  guarantees: {
    packetCreated: false;
    databaseWritten: false;
    docusignEnvelopeCreated: false;
    customerMessageSent: false;
    stripeSessionCreated: false;
    paymentMethodSaved: false;
    chargeCreated: false;
  };
}

function snapshotDigest(input: {
  snapshot: EnrollmentDocumentSnapshot;
  readiness: EnrollmentReadiness;
}): string {
  const durableSnapshot = { ...input.snapshot, createdAt: undefined };
  const agreementBindings = [
    input.readiness.approvedVersions.msa
      ? [
          input.readiness.approvedVersions.msa.version,
          input.readiness.approvedVersions.msa.contentSha256,
        ]
      : null,
    input.readiness.approvedVersions.serviceQuote
      ? [
          input.readiness.approvedVersions.serviceQuote.version,
          input.readiness.approvedVersions.serviceQuote.contentSha256,
        ]
      : null,
  ];
  return createHash("sha256")
    .update(
      JSON.stringify([
        "homeatlas-enrollment-preflight-v1",
        durableSnapshot,
        agreementBindings,
      ]),
      "utf8",
    )
    .digest("hex");
}

export function buildEnrollmentPreflightReport(input: {
  snapshot: EnrollmentDocumentSnapshot;
  readiness: EnrollmentReadiness;
  actorKind: "admin" | "sales_rep";
  presentationCanEnroll: boolean;
  existingPacketStatus: string | null;
  recipientGate: EnrollmentRecipientGate;
}): EnrollmentPreflightReport {
  const paymentRail = input.snapshot.payment?.rail ?? "stripe_card";
  const operatorReady =
    paymentRail !== "manual_cash_check" || input.actorKind === "admin";
  const packetReady =
    input.existingPacketStatus === null ||
    input.existingPacketStatus === "draft" ||
    input.existingPacketStatus === "needs_attention";
  const providerChecks = input.readiness.checks.map((check) => {
    const ignoredForManualPayment =
      paymentRail === "manual_cash_check" && check.id === "stripe";
    return {
      id: check.id,
      label: check.label,
      ready: check.ready || ignoredForManualPayment,
      detail: ignoredForManualPayment
        ? "Not required for this owner-approved cash/check arrangement."
        : check.detail,
    };
  });
  const checks: EnrollmentPreflightCheck[] = [
    {
      id: "presentation_status",
      label: "Unsigned presentation",
      ready: input.presentationCanEnroll,
      detail: input.presentationCanEnroll
        ? "The presentation can enter a new enrollment handoff."
        : "This presentation already has signed-agreement evidence.",
    },
    {
      id: "existing_packet",
      label: "Compatible handoff state",
      ready: packetReady,
      detail:
        input.existingPacketStatus === null
          ? "No enrollment packet exists for this presentation."
          : packetReady
            ? `The existing ${input.existingPacketStatus} packet can be safely reprepared by the send path.`
            : `An enrollment packet already exists with status ${input.existingPacketStatus}.`,
    },
    {
      id: "operator_authority",
      label: "Payment-rail authority",
      ready: operatorReady,
      detail: operatorReady
        ? paymentRail === "manual_cash_check"
          ? "HomeAtlas HQ is authorized to approve this cash/check arrangement."
          : "This handoff uses Stripe-hosted card setup after signature."
        : "A sales rep cannot approve a cash/check account; HomeAtlas HQ must send it.",
    },
    {
      id: "recipient_control",
      label: "Rollout recipient",
      ready: input.recipientGate.allowed,
      detail: input.recipientGate.detail,
    },
    ...providerChecks,
  ];
  const releaseBindingsReady = Boolean(
    input.readiness.approvedVersions.msa &&
      input.readiness.approvedVersions.serviceQuote &&
      input.readiness.legalIdentity,
  );

  return {
    mode: "no_side_effects",
    readyToSend:
      input.presentationCanEnroll &&
      packetReady &&
      operatorReady &&
      input.recipientGate.allowed &&
      releaseBindingsReady &&
      enrollmentReadyForPaymentRail(input.readiness, paymentRail),
    snapshotSha256: snapshotDigest({
      snapshot: input.snapshot,
      readiness: input.readiness,
    }),
    summary: {
      tierLabel: input.snapshot.plan.tierLabel,
      cadence: input.snapshot.plan.cadence,
      visitsPerYear: input.snapshot.plan.visitsPerYear,
      firstVisitPriceCents: input.snapshot.plan.firstVisitPriceCents,
      recurringVisitPriceCents: input.snapshot.plan.recurringVisitPriceCents,
      annualizedValueCents: input.snapshot.plan.annualizedValueCents,
      paymentRail,
      salesContext: input.snapshot.disclosures.salesContext,
      homeSolicitationNoticeDays:
        input.snapshot.disclosures.homeSolicitationNoticeDays,
      serviceAddressPresent: Boolean(input.snapshot.property.fullAddress),
      customerEmailPresent: Boolean(input.snapshot.customer.email),
    },
    checks,
    guarantees: {
      packetCreated: false,
      databaseWritten: false,
      docusignEnvelopeCreated: false,
      customerMessageSent: false,
      stripeSessionCreated: false,
      paymentMethodSaved: false,
      chargeCreated: false,
    },
  };
}
