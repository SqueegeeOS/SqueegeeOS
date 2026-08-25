import "server-only";

import { getResendEmailConfigState } from "@/lib/communications/providers/resend-email";
import {
  createServiceRoleSupabaseClient,
  isServiceRoleConfigured,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";
import { isStripeServerEnabled } from "@/lib/stripe/config";
import {
  getDocuSignConfigState,
  resolveDocuSignConfig,
} from "@/lib/integrations/docusign";
import type { ApprovedAgreementVersion } from "./types";
import type { PaymentRail } from "@/lib/billing/payment-rail";
import {
  getEnrollmentReleaseControlState,
  type EnrollmentReleaseControlState,
} from "./release-control";

export interface EnrollmentLegalIdentity {
  companyName: string;
  businessAddress: string;
  noticeEmail: string;
  phone: string;
}

export interface EnrollmentReadinessCheck {
  id:
    | "database"
    | "legal_documents"
    | "legal_identity"
    | "release_control"
    | "docusign"
    | "stripe"
    | "email";
  label: string;
  ready: boolean;
  detail: string;
  missing: string[];
}

export interface EnrollmentReadiness {
  readyToSend: boolean;
  checks: EnrollmentReadinessCheck[];
  approvedVersions: {
    msa: ApprovedAgreementVersion | null;
    serviceQuote: ApprovedAgreementVersion | null;
  };
  legalIdentity: EnrollmentLegalIdentity | null;
  releaseControl: EnrollmentReleaseControlState;
}

export function enrollmentReadyForPaymentRail(
  readiness: EnrollmentReadiness,
  paymentRail: PaymentRail,
): boolean {
  return readiness.checks.every(
    (check) =>
      check.ready ||
      (paymentRail === "manual_cash_check" && check.id === "stripe"),
  );
}

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export function resolveEnrollmentLegalIdentity(): EnrollmentLegalIdentity | null {
  const identity = {
    companyName: env("HOMEATLAS_LEGAL_COMPANY_NAME"),
    businessAddress: env("HOMEATLAS_LEGAL_BUSINESS_ADDRESS"),
    noticeEmail: env("HOMEATLAS_LEGAL_NOTICE_EMAIL").toLowerCase(),
    phone: env("HOMEATLAS_LEGAL_PHONE"),
  };
  return Object.values(identity).every(Boolean) ? identity : null;
}

export function enrollmentLegalIdentityMissing(): string[] {
  return [
    "HOMEATLAS_LEGAL_COMPANY_NAME",
    "HOMEATLAS_LEGAL_BUSINESS_ADDRESS",
    "HOMEATLAS_LEGAL_NOTICE_EMAIL",
    "HOMEATLAS_LEGAL_PHONE",
  ].filter((name) => !env(name));
}

function mapVersion(row: Record<string, unknown>): ApprovedAgreementVersion | null {
  if (
    typeof row.id !== "string" ||
    (row.document_kind !== "master_service_agreement" &&
      row.document_kind !== "service_quote_agreement") ||
    typeof row.version !== "string" ||
    typeof row.content_sha256 !== "string" ||
    typeof row.approved_at !== "string" ||
    typeof row.approved_by !== "string"
  ) {
    return null;
  }
  return {
    id: row.id,
    documentKind: row.document_kind,
    version: row.version,
    contentSha256: row.content_sha256,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
  };
}

async function loadApprovedVersions(): Promise<{
  msa: ApprovedAgreementVersion | null;
  serviceQuote: ApprovedAgreementVersion | null;
  databaseError: string | null;
}> {
  if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
    return { msa: null, serviceQuote: null, databaseError: "Supabase service access is not configured." };
  }
  try {
    const supabase = createServiceRoleSupabaseClient();
    const result = await supabase
      .from("agreement_document_versions")
      .select(
        "id, document_kind, version, content_sha256, approved_at, approved_by",
      )
      .eq("status", "approved");
    if (result.error) {
      return { msa: null, serviceQuote: null, databaseError: result.error.message };
    }
    const versions = (result.data ?? [])
      .map((row) => mapVersion(row as Record<string, unknown>))
      .filter((row): row is ApprovedAgreementVersion => row !== null);
    return {
      msa:
        versions.find(
          (version) => version.documentKind === "master_service_agreement",
        ) ?? null,
      serviceQuote:
        versions.find(
          (version) => version.documentKind === "service_quote_agreement",
        ) ?? null,
      databaseError: null,
    };
  } catch (error) {
    return {
      msa: null,
      serviceQuote: null,
      databaseError: error instanceof Error ? error.message : "Database check failed.",
    };
  }
}

export async function getEnrollmentReadiness(): Promise<EnrollmentReadiness> {
  const approved = await loadApprovedVersions();
  const databaseReady = approved.databaseError === null;
  const documentsReady = Boolean(approved.msa && approved.serviceQuote);
  const identity = resolveEnrollmentLegalIdentity();
  const identityMissing = enrollmentLegalIdentityMissing();
  const releaseControl = getEnrollmentReleaseControlState();
  const docusign = getDocuSignConfigState(resolveDocuSignConfig());
  const email = getResendEmailConfigState();
  const stripeMissing = [
    ...(isStripeServerEnabled()
      ? []
      : ["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "STRIPE_SECRET_KEY"]),
    ...(env("STRIPE_WEBHOOK_SECRET") ? [] : ["STRIPE_WEBHOOK_SECRET"]),
    ...(env("STRIPE_ENROLLMENT_SETUP_WEBHOOK_CONFIRMED") === "true"
      ? []
      : ["STRIPE_ENROLLMENT_SETUP_WEBHOOK_CONFIRMED"]),
  ];
  const stripeReady = stripeMissing.length === 0;

  const checks: EnrollmentReadinessCheck[] = [
    {
      id: "database",
      label: "Private enrollment ledger",
      ready: databaseReady,
      detail: databaseReady
        ? "The private packet and provider-event ledger is available."
        : approved.databaseError ?? "Apply migration 066.",
      missing: databaseReady ? [] : ["migration_066"],
    },
    {
      id: "legal_documents",
      label: "Owner-released documents",
      ready: documentsReady,
      detail: documentsReady
        ? `${approved.msa!.version} + ${approved.serviceQuote!.version}`
        : "The owner has not yet released and content-hashed the exact MSA and Service & Quote documents used by DocuSign.",
      missing: [
        ...(approved.msa ? [] : ["approved_master_service_agreement"]),
        ...(approved.serviceQuote ? [] : ["approved_service_quote_agreement"]),
      ],
    },
    {
      id: "legal_identity",
      label: "Legal seller identity",
      ready: Boolean(identity),
      detail: identity
        ? `${identity.companyName} · notices to ${identity.noticeEmail}`
        : "Add the exact LLC name, business address, notice email, and phone that appear in the released agreement.",
      missing: identityMissing,
    },
    {
      id: "release_control",
      label: "Enrollment rollout control",
      ready: releaseControl.ready,
      detail: releaseControl.detail,
      missing: releaseControl.missing,
    },
    {
      id: "docusign",
      label: "DocuSign embedded signing",
      ready: docusign.configured,
      detail: docusign.configured
        ? "Remote signing and HMAC-verified completion events are configured."
        : "DocuSign JWT, the two-document template, and Connect HMAC must be configured.",
      missing: docusign.missing,
    },
    {
      id: "stripe",
      label: "Stripe-hosted card setup",
      ready: stripeReady,
      detail: stripeReady
        ? "Setup-mode Checkout and the signed setup_intent.succeeded return path are confirmed."
        : "Configure Stripe Checkout, its signing secret, and prove setup_intent.succeeded reaches production.",
      missing: stripeMissing,
    },
    {
      id: "email",
      label: "Separate payment-link email",
      ready: email.configured,
      detail: email.configured
        ? "Resend can deliver the separate Stripe handoff and portal link."
        : "Configure Resend and a verified sender for the post-signature handoff.",
      missing: email.configured ? [] : email.missing,
    },
  ];

  return {
    readyToSend: checks.every((check) => check.ready),
    checks,
    approvedVersions: {
      msa: approved.msa,
      serviceQuote: approved.serviceQuote,
    },
    legalIdentity: identity,
    releaseControl,
  };
}
