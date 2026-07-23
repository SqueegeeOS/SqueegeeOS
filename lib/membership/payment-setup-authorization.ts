import "server-only";

import { createHash } from "node:crypto";
import { SQUEEGEEKING_TIERS } from "@/lib/membership/tier-config";
import {
  isAuthoritativePresentationQuoteSnapshot,
  type PresentationQuoteSnapshot,
} from "@/lib/presentations/quote-snapshot";
import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PORTAL_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
const SETUP_INTENT_PATTERN = /^seti_[A-Za-z0-9]{1,250}$/;

export type PaymentSetupCapability =
  | { kind: "presentation"; presentationId: string }
  | { kind: "portal"; portalToken: string };

export interface PaymentSetupRequest {
  capability: PaymentSetupCapability;
  setupIntentId?: string;
}

export class PaymentSetupInputError extends Error {}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parsePaymentSetupRequest(
  value: unknown,
  options: { requireSetupIntent: boolean },
): PaymentSetupRequest {
  if (!isObject(value)) {
    throw new PaymentSetupInputError("Request body must be a JSON object");
  }

  const allowed = options.requireSetupIntent
    ? new Set(["presentationId", "portalToken", "setupIntentId"])
    : new Set(["presentationId", "portalToken"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new PaymentSetupInputError("Request contains unsupported fields");
  }

  const presentationId = value.presentationId;
  const portalToken = value.portalToken;
  const hasPresentation = typeof presentationId === "string";
  const hasPortal = typeof portalToken === "string";
  if (hasPresentation === hasPortal) {
    throw new PaymentSetupInputError(
      "Exactly one onboarding capability is required",
    );
  }

  let capability: PaymentSetupCapability;
  if (hasPresentation) {
    if (!UUID_PATTERN.test(presentationId)) {
      throw new PaymentSetupInputError("Presentation capability is invalid");
    }
    capability = { kind: "presentation", presentationId };
  } else {
    if (!PORTAL_TOKEN_PATTERN.test(portalToken as string)) {
      throw new PaymentSetupInputError("Portal capability is invalid");
    }
    capability = { kind: "portal", portalToken: portalToken as string };
  }

  if (!options.requireSetupIntent) {
    return { capability };
  }

  const setupIntentId = value.setupIntentId;
  if (
    typeof setupIntentId !== "string" ||
    !SETUP_INTENT_PATTERN.test(setupIntentId)
  ) {
    throw new PaymentSetupInputError("SetupIntent reference is invalid");
  }

  return { capability, setupIntentId };
}

export async function readPaymentSetupRequest(
  request: Request,
  options: { requireSetupIntent: boolean },
): Promise<PaymentSetupRequest> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 2048) {
    throw new PaymentSetupInputError("Request body is too large");
  }
  const text = await request.text();
  if (text.length > 2048) {
    throw new PaymentSetupInputError("Request body is too large");
  }
  try {
    return parsePaymentSetupRequest(JSON.parse(text), options);
  } catch (error) {
    if (error instanceof PaymentSetupInputError) throw error;
    throw new PaymentSetupInputError("Request body must be valid JSON");
  }
}

export interface PaymentMembershipRow {
  id: string;
  homeowner_id: string;
  property_id: string;
  presentation_id: string | null;
  agreement_id: string | null;
  portal_access_token: string | null;
  status: string;
  sales_tier: string | null;
  visit_price: number | null;
  visits_per_year: number | null;
  stripe_customer_id: string | null;
  stripe_payment_method_id: string | null;
  stripe_setup_intent_id: string | null;
  payment_setup_completed_at: string | null;
  started_at: string | null;
}

interface PaymentPresentationRow {
  id: string;
  status: string;
  signed_at: string | null;
  agreement_id: string | null;
  membership_id: string | null;
  homeowner_id: string | null;
  property_id: string | null;
  onboarding_status: string | null;
  tier: string;
  enrollment_savings: number | null;
  authority_sha256: string | null;
  quote_snapshot: PresentationQuoteSnapshot | null;
}

interface PaymentAgreementRow {
  id: string;
  status: string;
  membership_id: string | null;
  presentation_id: string | null;
  homeowner_id: string | null;
  property_id: string | null;
  signing_attempt_id: string | null;
  agreement_tier: string | null;
}

interface PaymentHomeownerRow {
  id: string;
  full_name: string;
  email: string | null;
}

interface PaymentPropertyRow {
  id: string;
  homeowner_id: string;
}

export interface PaymentSetupReconciliationAttempt {
  id: string;
  membership_id: string;
  presentation_id: string;
  agreement_id: string;
  homeowner_id: string;
  property_id: string;
  capability_kind: "presentation" | "portal";
  sales_tier: "biannual" | "quarterly";
  visit_price: number;
  visits_per_year: number;
  enrollment_savings: number;
  presentation_authority_sha256: string;
  customer_idempotency_key: string;
  setup_intent_idempotency_key: string;
  operation_phase: "before_provider";
  operation_status: "reserved";
  created_at: string;
}

export interface PaymentSetupContext {
  membership: PaymentMembershipRow;
  presentation: PaymentPresentationRow;
  agreement: PaymentAgreementRow;
  homeowner: PaymentHomeownerRow;
  property: PaymentPropertyRow;
  reconciliationAttempt: PaymentSetupReconciliationAttempt | null;
}

const MEMBERSHIP_SELECT =
  "id, homeowner_id, property_id, presentation_id, agreement_id, portal_access_token, status, sales_tier, visit_price, visits_per_year, stripe_customer_id, stripe_payment_method_id, stripe_setup_intent_id, payment_setup_completed_at, started_at";
const PRESENTATION_SELECT =
  "id, status, signed_at, agreement_id, membership_id, homeowner_id, property_id, onboarding_status, tier, enrollment_savings, authority_sha256, quote_snapshot";

async function maybeSingle<T>(
  query: PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T | null> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as T | null) ?? null;
}

export async function loadPaymentSetupContext(
  supabase: SupabaseClient,
  capability: PaymentSetupCapability,
): Promise<PaymentSetupContext | null> {
  let membership: PaymentMembershipRow | null = null;
  let presentation: PaymentPresentationRow | null = null;

  if (capability.kind === "presentation") {
    presentation = await maybeSingle<PaymentPresentationRow>(
      supabase
        .from("presentations")
        .select(PRESENTATION_SELECT)
        .eq("id", capability.presentationId)
        .maybeSingle(),
    );
    if (!presentation?.membership_id) return null;
    membership = await maybeSingle<PaymentMembershipRow>(
      supabase
        .from("memberships")
        .select(MEMBERSHIP_SELECT)
        .eq("id", presentation.membership_id)
        .maybeSingle(),
    );
  } else {
    membership = await maybeSingle<PaymentMembershipRow>(
      supabase
        .from("memberships")
        .select(MEMBERSHIP_SELECT)
        .eq("portal_access_token", capability.portalToken)
        .maybeSingle(),
    );
    if (!membership?.presentation_id) return null;
    presentation = await maybeSingle<PaymentPresentationRow>(
      supabase
        .from("presentations")
        .select(PRESENTATION_SELECT)
        .eq("id", membership.presentation_id)
        .maybeSingle(),
    );
  }

  if (!membership || !presentation || !membership.agreement_id) return null;

  const [agreement, homeowner, property, reconciliationAttempt] = await Promise.all([
    maybeSingle<PaymentAgreementRow>(
      supabase
        .from("signed_agreements")
        .select(
          "id, status, membership_id, presentation_id, homeowner_id, property_id, signing_attempt_id, agreement_tier",
        )
        .eq("id", membership.agreement_id)
        .maybeSingle(),
    ),
    maybeSingle<PaymentHomeownerRow>(
      supabase
        .from("homeowners")
        .select("id, full_name, email")
        .eq("id", membership.homeowner_id)
        .maybeSingle(),
    ),
    maybeSingle<PaymentPropertyRow>(
      supabase
        .from("properties")
        .select("id, homeowner_id")
        .eq("id", membership.property_id)
        .maybeSingle(),
    ),
    maybeSingle<PaymentSetupReconciliationAttempt>(
      supabase
        .from("membership_stripe_setup_reconciliation_attempts")
        .select(
          "id, membership_id, presentation_id, agreement_id, homeowner_id, property_id, capability_kind, sales_tier, visit_price, visits_per_year, enrollment_savings, presentation_authority_sha256, customer_idempotency_key, setup_intent_idempotency_key, operation_phase, operation_status, created_at",
        )
        .eq("membership_id", membership.id)
        .maybeSingle(),
    ),
  ]);

  if (!agreement || !homeowner || !property) return null;
  return {
    membership,
    presentation,
    agreement,
    homeowner,
    property,
    reconciliationAttempt,
  };
}

export type PaymentSetupContextMode = "create" | "activate";

export function paymentSetupContextConflict(
  context: PaymentSetupContext,
  mode: PaymentSetupContextMode,
): string | null {
  const { membership, presentation, agreement, homeowner, property } = context;
  const linkageValid =
    membership.presentation_id === presentation.id &&
    membership.agreement_id === agreement.id &&
    membership.homeowner_id === homeowner.id &&
    membership.property_id === property.id &&
    property.homeowner_id === homeowner.id &&
    presentation.membership_id === membership.id &&
    presentation.agreement_id === agreement.id &&
    presentation.homeowner_id === homeowner.id &&
    presentation.property_id === property.id &&
    agreement.membership_id === membership.id &&
    agreement.presentation_id === presentation.id &&
    agreement.homeowner_id === homeowner.id &&
    agreement.property_id === property.id;

  if (!linkageValid) return "authoritative_linkage_mismatch";
  if (presentation.status !== "signed" || !presentation.signed_at) {
    return "presentation_not_signed";
  }
  if (agreement.status !== "complete") return "agreement_not_complete";
  const tier = membership.sales_tier;
  if (
    (tier !== "biannual" && tier !== "quarterly") ||
    membership.visit_price == null ||
    !Number.isFinite(Number(membership.visit_price)) ||
    membership.visits_per_year == null ||
    membership.visits_per_year <= 0
  ) {
    return "membership_terms_incomplete";
  }
  if (
    presentation.tier !== tier ||
    agreement.agreement_tier !== tier ||
    !agreement.signing_attempt_id ||
    !presentation.authority_sha256 ||
    !/^[0-9a-f]{64}$/.test(presentation.authority_sha256) ||
    !isAuthoritativePresentationQuoteSnapshot(presentation.quote_snapshot) ||
    presentation.quote_snapshot.tierVisitPrices[tier] !==
      Number(membership.visit_price) ||
    membership.visits_per_year !== SQUEEGEEKING_TIERS[tier].visitsPerYear
  ) {
    return "signed_pricing_authority_mismatch";
  }
  if (
    context.reconciliationAttempt &&
    (context.reconciliationAttempt.membership_id !== membership.id ||
      context.reconciliationAttempt.presentation_id !== presentation.id ||
      context.reconciliationAttempt.agreement_id !== agreement.id ||
      context.reconciliationAttempt.homeowner_id !== homeowner.id ||
      context.reconciliationAttempt.property_id !== property.id ||
      context.reconciliationAttempt.sales_tier !== tier ||
      Number(context.reconciliationAttempt.visit_price) !==
        Number(membership.visit_price) ||
      context.reconciliationAttempt.visits_per_year !==
        membership.visits_per_year ||
      Number(context.reconciliationAttempt.enrollment_savings) !==
        Number(presentation.quote_snapshot.tierEnrollmentSavings[tier]) ||
      context.reconciliationAttempt.presentation_authority_sha256 !==
        presentation.authority_sha256 ||
      context.reconciliationAttempt.customer_idempotency_key !==
        `homeatlas:membership-customer:v1:${membership.id}` ||
      context.reconciliationAttempt.setup_intent_idempotency_key !==
        `homeatlas:membership-setup:v2:${membership.id}` ||
      context.reconciliationAttempt.operation_phase !== "before_provider" ||
      context.reconciliationAttempt.operation_status !== "reserved")
  ) {
    return "reconciliation_authority_mismatch";
  }
  if (mode === "activate" && !context.reconciliationAttempt) {
    return "missing_provider_reconciliation_attempt";
  }

  if (membership.status === "pending_payment") {
    if (presentation.onboarding_status !== "pending_payment") {
      return "presentation_onboarding_state_mismatch";
    }
    if (membership.payment_setup_completed_at) {
      return "pending_membership_has_payment_completion";
    }
    if (membership.stripe_payment_method_id) {
      return "pending_membership_has_payment_method";
    }
    return null;
  }

  if (
    mode === "activate" &&
    membership.status === "active" &&
    presentation.onboarding_status === "complete" &&
    membership.payment_setup_completed_at &&
    membership.stripe_customer_id &&
    membership.stripe_payment_method_id &&
    membership.stripe_setup_intent_id
  ) {
    return null;
  }

  return `membership_state_${membership.status || "unknown"}`;
}

export function paymentSetupMetadata(
  context: PaymentSetupContext,
  reconciliationAttemptId: string,
) {
  return {
    homeatlas_flow: "membership_setup_v1",
    membership_id: context.membership.id,
    presentation_id: context.presentation.id,
    agreement_id: context.agreement.id,
    homeowner_id: context.homeowner.id,
    property_id: context.property.id,
    presentation_authority_sha256: context.presentation.authority_sha256!,
    reconciliation_attempt_id: reconciliationAttemptId,
  } as const;
}

export function capabilityAuditKind(
  capability: PaymentSetupCapability,
): "presentation" | "portal" {
  return capability.kind;
}

export function reconciliationFactKey(
  fact: string,
  detail?: string,
): string {
  if (!/^[a-z0-9_]{1,48}$/.test(fact)) {
    throw new Error("Reconciliation fact key is invalid");
  }
  if (!detail) return fact;
  const detailHash = createHash("sha256").update(detail).digest("hex").slice(0, 32);
  return `${fact}:${detailHash}`;
}

export async function reservePaymentSetupReconciliation(
  supabase: SupabaseClient,
  context: PaymentSetupContext,
  capabilityKind: "presentation" | "portal",
): Promise<PaymentSetupReconciliationAttempt | { outcome: "held"; reason?: string }> {
  const { data, error } = await supabase.rpc(
    "reserve_membership_stripe_setup_reconciliation",
    {
      p_membership_id: context.membership.id,
      p_presentation_id: context.presentation.id,
      p_agreement_id: context.agreement.id,
      p_homeowner_id: context.homeowner.id,
      p_property_id: context.property.id,
      p_expected_authority_sha256: context.presentation.authority_sha256,
      p_capability_kind: capabilityKind,
    },
  );
  if (error || !data) {
    throw new Error(error?.message ?? "Provider reconciliation reservation returned no result");
  }
  if (
    typeof data === "object" &&
    data !== null &&
    "outcome" in data &&
    data.outcome === "held"
  ) {
    return data as { outcome: "held"; reason?: string };
  }
  const row = data as Record<string, unknown>;
  if (
    (row.outcome !== "reserved" && row.outcome !== "replay") ||
    typeof row.attempt !== "object" ||
    !row.attempt
  ) {
    throw new Error("Provider reconciliation reservation was malformed");
  }
  const attempt = row.attempt as Record<string, unknown>;
  const tier = context.membership.sales_tier as "biannual" | "quarterly";
  const expectedSavings =
    context.presentation.quote_snapshot?.tierEnrollmentSavings?.[tier];
  if (
    typeof attempt.id !== "string" ||
    !UUID_PATTERN.test(attempt.id) ||
    attempt.membership_id !== context.membership.id ||
    attempt.presentation_id !== context.presentation.id ||
    attempt.agreement_id !== context.agreement.id ||
    attempt.homeowner_id !== context.homeowner.id ||
    attempt.property_id !== context.property.id ||
    (attempt.capability_kind !== "presentation" &&
      attempt.capability_kind !== "portal") ||
    attempt.sales_tier !== tier ||
    Number(attempt.visit_price) !== Number(context.membership.visit_price) ||
    Number(attempt.visits_per_year) !== context.membership.visits_per_year ||
    Number(attempt.enrollment_savings) !== Number(expectedSavings) ||
    attempt.presentation_authority_sha256 !==
      context.presentation.authority_sha256 ||
    attempt.customer_idempotency_key !==
      `homeatlas:membership-customer:v1:${context.membership.id}` ||
    attempt.setup_intent_idempotency_key !==
      `homeatlas:membership-setup:v2:${context.membership.id}` ||
    attempt.operation_phase !== "before_provider" ||
    attempt.operation_status !== "reserved" ||
    typeof attempt.created_at !== "string"
  ) {
    throw new Error("Provider reconciliation reservation was malformed");
  }
  return attempt as unknown as PaymentSetupReconciliationAttempt;
}

export async function appendPaymentSetupReconciliationEvent(
  supabase: SupabaseClient,
  input: {
    attemptId: string;
    eventKey: string;
    phase: "customer" | "setup_intent" | "claim" | "activation";
    status:
      | "observed"
      | "created"
      | "claimed"
      | "ready"
      | "held"
      | "failed"
      | "activated"
      | "replayed";
    stripeCustomerId?: string | null;
    stripeSetupIntentId?: string | null;
    outcome?: string | null;
    errorCode?: string | null;
  },
): Promise<void> {
  const { data, error } = await supabase.rpc(
    "append_membership_stripe_setup_reconciliation_event",
    {
      p_attempt_id: input.attemptId,
      p_event_key: input.eventKey,
      p_operation_phase: input.phase,
      p_operation_status: input.status,
      p_stripe_customer_id: input.stripeCustomerId ?? null,
      p_stripe_setup_intent_id: input.stripeSetupIntentId ?? null,
      p_outcome: input.outcome ?? null,
      p_error_code: input.errorCode ?? null,
    },
  );
  if (
    error ||
    !data ||
    typeof data !== "object" ||
    !("outcome" in data) ||
    (data.outcome !== "appended" && data.outcome !== "replay")
  ) {
    throw new Error(
      error?.message ?? "Provider reconciliation event was not durably appended",
    );
  }
}
