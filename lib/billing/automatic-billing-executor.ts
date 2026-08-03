import "server-only";

import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { JOBBER_CONNECTION_ID } from "@/lib/care-operations/jobber-oauth-config";
import { isStripeLiveMode } from "@/lib/stripe/mode";
import { getStripe } from "@/lib/stripe/server";
import { notifyAutomaticBillingResult } from "./automatic-billing-notifications";
import {
  automaticBillingBlockingReasons,
  automaticBillingMonthBounds,
  automaticBillingRetryAt,
  automaticBillingServiceMonth,
  dollarsToBillingCents,
  type AutomaticBillingAppointmentInput,
  type AutomaticBillingMembershipInput,
} from "./automatic-billing-rules";
import { jobberScheduledChargeDecision } from "./jobber-scheduled-charge";
import { membershipBillingAuthorizationIssues } from "./membership-billing-authorization";
import { recordBillingReconciliationCase } from "./reconciliation";
import {
  billingPaymentIntentBindingIssues,
  stripePaymentIntentReference,
} from "./stripe-payment-intent-binding";
import { prepareAutomaticBillingOrders } from "./automatic-billing-candidates";
import {
  currentStripeWebhookSecretFingerprint,
  isFirstBusinessDay,
  isCurrentStripeWebhookVerified,
  loadAutomaticBillingSettings,
  recordAutomaticBillingRunOnSettings,
} from "./automatic-billing-settings";

export type AutomaticBillingTriggerSource =
  | "cron"
  | "founder_manual"
  | "founder_retry";

interface ClaimedBillingOrder {
  id: string;
  membership_id: string;
  property_id: string;
  obligation_id: string | null;
  appointment_id: string;
  pricing_snapshot_id: string;
  service_month: string;
  scheduled_service_at: string;
  expected_charge_cents: number;
  idempotency_key: string;
  attempt_count: number;
  stripe_payment_intent_id: string | null;
  input_fingerprint: string;
}

interface ExecutionMembershipRow {
  id: string;
  homeowner_id: string;
  property_id: string;
  status: string;
  billing_schedule: string;
  agreement_id: string | null;
  payment_setup_completed_at: string | null;
  stripe_customer_id: string | null;
  stripe_payment_method_id: string | null;
  visit_price: number | string | null;
  automatic_billing_enabled: boolean;
}

interface ExecutionAppointmentRow {
  id: string;
  property_id: string;
  provider: string | null;
  external_id: string | null;
  scheduled_at: string;
  status: string;
  provenance_state: string;
  verification_state: string;
  match_state: string;
  matched_obligation_id: string | null;
}

interface ExecutionSnapshotRow {
  id: string;
  membership_id: string;
  property_id: string;
  obligation_id: string | null;
  engine_version: string;
  company_settings_hash: string;
  normalized_inputs: Record<string, unknown>;
  authorized_charge_cents: number;
  override_amount_cents: number | null;
}

interface ExecutionAgreementRow {
  id: string;
  status: string;
  membership_id: string | null;
  property_id: string | null;
  billing_authorization_version: string | null;
  billing_authorized_at: string | null;
  authorized_visit_price_cents: number | null;
  billing_terms_hash: string | null;
}

interface ExecutionProjectionRow {
  connection_id: string;
  external_visit_id: string;
  external_job_id: string;
  external_property_id: string;
  scheduled_start: string | null;
  is_complete: boolean;
  source_payload_hash: string;
  title: string | null;
  job_type: string | null;
  job_billing_type: string | null;
  job_total_cents: number | null;
  job_will_auto_charge: boolean;
  visit_invoice_id: string | null;
  visit_invoice_status: string | null;
  is_last_scheduled_visit: boolean;
  match_state: string;
  matched_property_id: string | null;
}

interface ExecutionPropertyLinkRow {
  connection_id: string;
  external_property_id: string;
  membership_id: string;
  property_id: string;
  link_state: string;
}

interface HomeownerRow {
  id: string;
  full_name: string;
  first_name: string | null;
  email: string | null;
}

interface PropertyRow {
  id: string;
  address: string;
  city: string;
  state: string;
}

interface ExistingChargeRow {
  id: string;
  status: string;
  amount: number | string;
  authorized_amount_cents: number | null;
  stripe_reference: string | null;
  stripe_payment_intent_id: string | null;
  billing_authority_verified_at: string | null;
  billing_authority_verified_by: string | null;
}

export interface AutomaticBillingRunSummary {
  runId: string;
  status: "disabled" | "succeeded" | "partial" | "failed";
  serviceMonth: string;
  executionMode: string;
  firstBusinessDay: boolean;
  prepared: Awaited<ReturnType<typeof prepareAutomaticBillingOrders>> | null;
  claimed: number;
  paid: number;
  failed: number;
  needsAction: number;
  skipped: number;
  deferred: boolean;
}

function finalizedExecutionState(data: unknown): string | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const value = (row as { execution_state?: unknown }).execution_state;
  return typeof value === "string" ? value : null;
}

function membershipInput(
  row: ExecutionMembershipRow,
  agreement: ExecutionAgreementRow | null,
): AutomaticBillingMembershipInput {
  const currentVisitPriceCents =
    row.visit_price === null
      ? null
      : dollarsToBillingCents(Number(row.visit_price));
  return {
    id: row.id,
    status: row.status,
    agreementId: row.agreement_id,
    paymentSetupCompletedAt: row.payment_setup_completed_at,
    stripeCustomerId: row.stripe_customer_id,
    stripePaymentMethodId: row.stripe_payment_method_id,
    visitPrice: row.visit_price === null ? null : Number(row.visit_price),
    automaticBillingEnabled: row.automatic_billing_enabled,
    billingAuthorizationIssues: membershipBillingAuthorizationIssues({
      agreementId: row.agreement_id,
      agreementStatus: agreement?.status ?? null,
      agreementMembershipId: agreement?.membership_id ?? null,
      agreementPropertyId: agreement?.property_id ?? null,
      billingAuthorizationVersion:
        agreement?.billing_authorization_version ?? null,
      billingAuthorizedAt: agreement?.billing_authorized_at ?? null,
      billingTermsHash: agreement?.billing_terms_hash ?? null,
      authorizedVisitPriceCents:
        agreement?.authorized_visit_price_cents ?? null,
      membershipId: row.id,
      propertyId: row.property_id,
      currentVisitPriceCents,
    }),
  };
}

function appointmentInput(
  row: ExecutionAppointmentRow,
  jobberBillingVerified: boolean,
): AutomaticBillingAppointmentInput {
  return {
    id: row.id,
    provider: row.provider,
    externalId: row.external_id,
    scheduledAt: row.scheduled_at,
    status: row.status,
    provenanceState: row.provenance_state,
    verificationState: row.verification_state,
    matchState: row.match_state,
    jobberBillingVerified,
  };
}

function stripeErrorCode(error: unknown): string {
  if (error instanceof Stripe.errors.StripeError) {
    return error.code ?? error.type ?? "stripe_error";
  }
  return error instanceof Error ? error.name : "unknown_error";
}

function stripeErrorMessage(error: unknown): string {
  if (error instanceof Stripe.errors.StripeCardError) {
    return error.decline_code
      ? `Card declined (${error.decline_code}). The member needs to update or approve their card.`
      : "Card declined. The member needs to update or approve their card.";
  }
  return error instanceof Error
    ? error.message.slice(0, 500)
    : "Stripe could not process the automatic payment.";
}

function errorPaymentIntent(error: unknown): Stripe.PaymentIntent | null {
  if (!(error instanceof Stripe.errors.StripeError)) return null;
  const intent = error.payment_intent;
  return intent && typeof intent !== "string" ? intent : null;
}

function isRetryableStripeError(error: unknown): boolean {
  if (!(error instanceof Stripe.errors.StripeError)) return false;
  return [
    "StripeAPIError",
    "StripeConnectionError",
    "StripeRateLimitError",
  ].includes(error.type);
}

function paymentIntentNeedsAction(intent: Stripe.PaymentIntent | null): boolean {
  return Boolean(
    intent &&
      ["requires_action", "requires_payment_method"].includes(intent.status),
  );
}

async function loadExecutionContext(order: ClaimedBillingOrder): Promise<{
  membership: ExecutionMembershipRow;
  appointment: ExecutionAppointmentRow;
  snapshot: ExecutionSnapshotRow;
  agreement: ExecutionAgreementRow | null;
  projection: ExecutionProjectionRow | null;
  propertyLink: ExecutionPropertyLinkRow | null;
  isFirstVisitForJobInServiceMonth: boolean;
  homeowner: HomeownerRow;
  property: PropertyRow;
}> {
  const supabase = createServiceRoleSupabaseClient();
  const [membershipResult, appointmentResult, snapshotResult, propertyResult] =
    await Promise.all([
      supabase
        .from("memberships")
        .select(
          "id, homeowner_id, property_id, status, billing_schedule, agreement_id, payment_setup_completed_at, stripe_customer_id, stripe_payment_method_id, visit_price, automatic_billing_enabled",
        )
        .eq("id", order.membership_id)
        .single(),
      supabase
        .from("member_appointments")
        .select(
          "id, property_id, provider, external_id, scheduled_at, status, provenance_state, verification_state, match_state, matched_obligation_id",
        )
        .eq("id", order.appointment_id)
        .single(),
      supabase
        .from("atlas_pricing_snapshots")
        .select(
          "id, membership_id, property_id, obligation_id, engine_version, company_settings_hash, normalized_inputs, authorized_charge_cents, override_amount_cents",
        )
        .eq("id", order.pricing_snapshot_id)
        .single(),
      supabase
        .from("properties")
        .select("id, address, city, state")
        .eq("id", order.property_id)
        .single(),
    ]);
  for (const result of [
    membershipResult,
    appointmentResult,
    snapshotResult,
    propertyResult,
  ]) {
    if (result.error) throw new Error(result.error.message);
  }
  const membership = membershipResult.data as ExecutionMembershipRow;
  const appointment = appointmentResult.data as ExecutionAppointmentRow;
  const [homeownerResult, agreementResult, projectionResult] =
    await Promise.all([
      supabase
        .from("homeowners")
        .select("id, full_name, first_name, email")
        .eq("id", membership.homeowner_id)
        .single(),
      membership.agreement_id
        ? supabase
            .from("signed_agreements")
            .select(
              "id, status, membership_id, property_id, billing_authorization_version, billing_authorized_at, authorized_visit_price_cents, billing_terms_hash",
            )
            .eq("id", membership.agreement_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      appointment.external_id
        ? supabase
            .from("jobber_visit_projections")
            .select(
              "connection_id, external_visit_id, external_job_id, external_property_id, scheduled_start, is_complete, source_payload_hash, title, job_type, job_billing_type, job_total_cents, job_will_auto_charge, visit_invoice_id, visit_invoice_status, is_last_scheduled_visit, match_state, matched_property_id",
            )
            .eq("connection_id", JOBBER_CONNECTION_ID)
            .eq("external_visit_id", appointment.external_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
  for (const result of [homeownerResult, agreementResult, projectionResult]) {
    if (result.error) throw new Error(result.error.message);
  }
  const projection =
    (projectionResult.data as ExecutionProjectionRow | null) ?? null;
  const propertyLinkResult = projection
    ? await supabase
          .from("jobber_property_links")
          .select(
            "connection_id, external_property_id, membership_id, property_id, link_state",
          )
          .eq("connection_id", projection.connection_id)
          .eq("external_property_id", projection.external_property_id)
          .eq("membership_id", membership.id)
          .eq("property_id", membership.property_id)
          .eq("link_state", "active")
          .maybeSingle()
    : { data: null, error: null };
  if (propertyLinkResult.error) throw new Error(propertyLinkResult.error.message);
  let isFirstVisitForJobInServiceMonth = false;
  if (projection) {
    const bounds = automaticBillingMonthBounds(new Date(order.scheduled_service_at));
    const firstVisitResult = await supabase
      .from("jobber_visit_projections")
      .select("external_visit_id")
      .eq("connection_id", projection.connection_id)
      .eq("external_job_id", projection.external_job_id)
      .gte("scheduled_start", bounds.startUtc.toISOString())
      .lt("scheduled_start", bounds.endUtc.toISOString())
      .order("scheduled_start", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (firstVisitResult.error) throw new Error(firstVisitResult.error.message);
    isFirstVisitForJobInServiceMonth =
      firstVisitResult.data?.external_visit_id === projection.external_visit_id;
  }
  return {
    membership,
    appointment,
    snapshot: snapshotResult.data as ExecutionSnapshotRow,
    agreement:
      (agreementResult.data as ExecutionAgreementRow | null) ?? null,
    projection,
    propertyLink:
      (propertyLinkResult.data as ExecutionPropertyLinkRow | null) ?? null,
    isFirstVisitForJobInServiceMonth,
    homeowner: homeownerResult.data as HomeownerRow,
    property: propertyResult.data as PropertyRow,
  };
}

function contextBlockingReasons(input: {
  order: ClaimedBillingOrder;
  membership: ExecutionMembershipRow;
  appointment: ExecutionAppointmentRow;
  snapshot: ExecutionSnapshotRow;
  agreement: ExecutionAgreementRow | null;
  projection: ExecutionProjectionRow | null;
  propertyLink: ExecutionPropertyLinkRow | null;
  isFirstVisitForJobInServiceMonth: boolean;
  maxChargeCents: number;
}): string[] {
  const pricingDecision = input.projection
    ? jobberScheduledChargeDecision({
        externalJobId: input.projection.external_job_id,
        externalVisitId: input.projection.external_visit_id,
        jobType: input.projection.job_type,
        billingType: input.projection.job_billing_type,
        jobTotalCents: input.projection.job_total_cents,
        jobWillAutoCharge: input.projection.job_will_auto_charge,
        visitInvoiceId: input.projection.visit_invoice_id,
        visitInvoiceStatus: input.projection.visit_invoice_status,
        isLastScheduledVisit: input.projection.is_last_scheduled_visit,
        isFirstVisitForJobInServiceMonth:
          input.isFirstVisitForJobInServiceMonth,
        serviceMonth: input.order.service_month,
      })
    : null;
  const jobberBillingVerified = Boolean(
    input.projection &&
      input.projection.external_visit_id === input.appointment.external_id &&
      input.projection.scheduled_start === input.appointment.scheduled_at &&
      input.projection.is_complete === false &&
      input.projection.match_state === "matched" &&
      input.projection.matched_property_id === input.order.property_id &&
      input.propertyLink &&
      input.propertyLink.link_state === "active" &&
      input.propertyLink.connection_id === input.projection.connection_id &&
      input.propertyLink.external_property_id ===
        input.projection.external_property_id &&
      input.propertyLink.membership_id === input.membership.id &&
      input.propertyLink.property_id === input.membership.property_id &&
      pricingDecision?.eligible,
  );
  const reasons = automaticBillingBlockingReasons({
    membership: membershipInput(input.membership, input.agreement),
    appointment: appointmentInput(
      input.appointment,
      jobberBillingVerified,
    ),
    serviceMonth: input.order.service_month,
  });
  const effectiveSnapshotAmount =
    input.snapshot.override_amount_cents ??
    input.snapshot.authorized_charge_cents;
  if (input.membership.billing_schedule !== "first_of_service_month") {
    reasons.push("billing_schedule_changed");
  }
  if (input.membership.property_id !== input.order.property_id) {
    reasons.push("membership_property_mismatch");
  }
  if (input.appointment.property_id !== input.order.property_id) {
    reasons.push("appointment_property_mismatch");
  }
  if (input.appointment.scheduled_at !== input.order.scheduled_service_at) {
    reasons.push("appointment_time_changed");
  }
  if (
    input.snapshot.membership_id !== input.order.membership_id ||
    input.snapshot.property_id !== input.order.property_id ||
    input.snapshot.obligation_id !== null ||
    input.order.obligation_id !== null ||
    input.snapshot.engine_version !== "jobber-scheduled-services-v2" ||
    input.snapshot.company_settings_hash !== input.order.input_fingerprint
  ) {
    reasons.push("pricing_snapshot_binding_mismatch");
  }
  if (effectiveSnapshotAmount !== input.order.expected_charge_cents) {
    reasons.push("pricing_snapshot_amount_mismatch");
  }
  if (!pricingDecision) reasons.push("jobber_projection_missing");
  else {
    reasons.push(...pricingDecision.blockers);
    if (pricingDecision.amountCents !== input.order.expected_charge_cents) {
      reasons.push("jobber_price_changed");
    }
    const normalized = input.snapshot.normalized_inputs;
    if (
      normalized.external_job_id !== input.projection?.external_job_id ||
      normalized.external_visit_id !== input.projection?.external_visit_id ||
      normalized.jobber_source_payload_hash !==
        input.projection?.source_payload_hash ||
      normalized.billing_unit_key !== pricingDecision.billingUnitKey ||
      normalized.job_total_cents !== pricingDecision.amountCents
    ) {
      reasons.push("jobber_pricing_snapshot_changed");
    }
  }
  if (input.order.expected_charge_cents > input.maxChargeCents) {
    reasons.push("charge_above_founder_cap");
  }
  return [...new Set(reasons)];
}

function paymentIntentBindingIssues(input: {
  order: ClaimedBillingOrder;
  context: Awaited<ReturnType<typeof loadExecutionContext>>;
  intent: Stripe.PaymentIntent;
}): string[] {
  return billingPaymentIntentBindingIssues(input.intent, {
    billingOrderId: input.order.id,
    membershipId: input.order.membership_id,
    propertyId: input.order.property_id,
    appointmentId: input.order.appointment_id,
    serviceMonth: input.order.service_month,
    expectedChargeCents: input.order.expected_charge_cents,
    stripeCustomerId: input.context.membership.stripe_customer_id!,
    stripePaymentIntentId: input.order.stripe_payment_intent_id,
    livemode: true,
  });
}

function isVerifiedPaidCharge(row: ExistingChargeRow): boolean {
  return (
    ["paid", "charged"].includes(row.status) &&
    Boolean(
      row.billing_authority_verified_at &&
        row.billing_authority_verified_by?.trim(),
    )
  );
}

function existingChargeLedgerIssues(
  row: ExistingChargeRow,
  order: ClaimedBillingOrder,
): string[] {
  const issues: string[] = [];
  if (Math.round(Number(row.amount) * 100) !== order.expected_charge_cents) {
    issues.push("ledger_amount_mismatch");
  }
  if (
    row.authorized_amount_cents !== null &&
    row.authorized_amount_cents !== order.expected_charge_cents
  ) {
    issues.push("ledger_authorized_amount_mismatch");
  }
  const isPaid = ["paid", "charged"].includes(row.status);
  if (isPaid && !isVerifiedPaidCharge(row)) {
    issues.push("historical_paid_ledger_not_post_hardening_verified");
  }
  if (
    isPaid &&
    order.stripe_payment_intent_id &&
    row.stripe_payment_intent_id !== order.stripe_payment_intent_id
  ) {
    issues.push("paid_ledger_payment_intent_mismatch");
  }
  const hasRecordedProviderReference = Boolean(
    row.stripe_payment_intent_id || row.stripe_reference,
  );
  const providerReferenceMatchesClaimedOrder = Boolean(
    order.stripe_payment_intent_id &&
      row.stripe_payment_intent_id === order.stripe_payment_intent_id &&
      (!row.stripe_reference ||
        row.stripe_reference === row.stripe_payment_intent_id),
  );
  if (
    !isPaid &&
    hasRecordedProviderReference &&
    !providerReferenceMatchesClaimedOrder
  ) {
    issues.push("unbound_historical_provider_reference");
  }
  return issues;
}

async function quarantineExistingCharge(input: {
  order: ClaimedBillingOrder;
  row: ExistingChargeRow;
  attemptNumber: number;
  attemptedAt: string;
  issues: string[];
}): Promise<ExistingChargeRow> {
  await recordBillingReconciliationCase({
    billingOrderId: input.order.id,
    stripeObjectId: null,
    discrepancyType: "status_mismatch",
    evidence: {
      reasons: input.issues,
      charge_id: input.row.id,
      recorded_stripe_reference: input.row.stripe_reference,
      recorded_payment_intent_id: input.row.stripe_payment_intent_id,
    },
  });
  const supabase = createServiceRoleSupabaseClient();
  const finalized = await supabase.rpc("finalize_billing_attempt_failure", {
    p_order_id: input.order.id,
    p_attempt_number: input.attemptNumber,
    p_outcome: "reconciliation_required",
    p_intent_id: input.order.stripe_payment_intent_id,
    p_next_attempt_at: null,
    p_failure_code: "existing_ledger_requires_reconciliation",
    p_failure_message:
      "An existing billing ledger row must be independently reconciled before Atlas can attempt a charge.",
    p_completed_at: input.attemptedAt,
  });
  if (finalized.error) throw new Error(finalized.error.message);
  if (finalizedExecutionState(finalized.data) === "succeeded") {
    return input.row;
  }
  throw new Error(
    "Existing billing ledger requires founder reconciliation; no charge was attempted.",
  );
}

async function upsertPendingCharge(input: {
  order: ClaimedBillingOrder;
  context: Awaited<ReturnType<typeof loadExecutionContext>>;
  attemptNumber: number;
  attemptedAt: string;
}): Promise<ExistingChargeRow | null> {
  const supabase = createServiceRoleSupabaseClient();
  const existing = await supabase
    .from("membership_billing_charges")
    .select(
      "id, status, amount, authorized_amount_cents, stripe_reference, stripe_payment_intent_id, billing_authority_verified_at, billing_authority_verified_by",
    )
    .eq("membership_id", input.order.membership_id)
    .eq("appointment_id", input.order.appointment_id)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  const row = (existing.data as ExistingChargeRow | null) ?? null;
  if (!row) {
    const legacy = await supabase
      .from("membership_billing_charges")
      .select(
        "id, status, amount, authorized_amount_cents, stripe_reference, stripe_payment_intent_id, billing_authority_verified_at, billing_authority_verified_by",
      )
      .eq("membership_id", input.order.membership_id)
      .eq("service_month", input.order.service_month)
      .is("appointment_id", null)
      .limit(1)
      .maybeSingle();
    if (legacy.error) throw new Error(legacy.error.message);
    if (legacy.data) {
      return quarantineExistingCharge({
        order: input.order,
        row: legacy.data as ExistingChargeRow,
        attemptNumber: input.attemptNumber,
        attemptedAt: input.attemptedAt,
        issues: ["legacy_monthly_ledger_without_appointment_binding"],
      });
    }
  }
  if (row) {
    const ledgerIssues = existingChargeLedgerIssues(row, input.order);
    if (isVerifiedPaidCharge(row) && ledgerIssues.length === 0) return row;
    if (ledgerIssues.length > 0) {
      return quarantineExistingCharge({
        order: input.order,
        row,
        attemptNumber: input.attemptNumber,
        attemptedAt: input.attemptedAt,
        issues: ledgerIssues,
      });
    }
  }
  const values = {
    membership_id: input.order.membership_id,
    homeowner_id: input.context.membership.homeowner_id,
    property_id: input.order.property_id,
    appointment_id: input.order.appointment_id,
    scheduled_service_at: input.order.scheduled_service_at,
    service_month: input.order.service_month,
    visit_price: input.order.expected_charge_cents / 100,
    amount: input.order.expected_charge_cents / 100,
    amount_collected: 0,
    authorized_amount_cents: input.order.expected_charge_cents,
    status: "pending",
    charged_at: null,
    billing_method: "automatic_stripe",
    notes: "Automatic first-of-service-month scheduled-service billing",
    created_by: "billing_automation",
    attempt_count: input.attemptNumber,
    last_attempt_at: input.attemptedAt,
    next_retry_at: null,
    failure_code: null,
    failure_message: null,
  };
  const result = row
    ? await supabase
        .from("membership_billing_charges")
        .update(values)
        .eq("id", row.id)
        .in("status", ["pending", "failed"])
        .select(
          "id, status, amount, authorized_amount_cents, stripe_reference, stripe_payment_intent_id, billing_authority_verified_at, billing_authority_verified_by",
        )
        .maybeSingle()
    : await supabase
        .from("membership_billing_charges")
        .insert(values)
        .select("id")
        .single();
  if (result.error) throw new Error(result.error.message);
  if (row && !result.data) {
    const refreshed = await supabase
      .from("membership_billing_charges")
      .select(
        "id, status, amount, authorized_amount_cents, stripe_reference, stripe_payment_intent_id, billing_authority_verified_at, billing_authority_verified_by",
      )
      .eq("id", row.id)
      .single();
    if (refreshed.error) throw new Error(refreshed.error.message);
    const current = refreshed.data as ExistingChargeRow;
    const currentIssues = existingChargeLedgerIssues(current, input.order);
    if (isVerifiedPaidCharge(current) && currentIssues.length === 0) {
      return current;
    }
    return quarantineExistingCharge({
      order: input.order,
      row: current,
      attemptNumber: input.attemptNumber,
      attemptedAt: input.attemptedAt,
      issues:
        currentIssues.length > 0
          ? currentIssues
          : ["ledger_compare_and_set_lost"],
    });
  }
  return null;
}

async function markAlreadyPaid(
  order: ClaimedBillingOrder,
  charge: ExistingChargeRow,
  attemptNumber: number,
): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const intentId =
    charge.stripe_payment_intent_id ?? order.stripe_payment_intent_id;
  const result = await supabase.rpc("finalize_billing_attempt_success", {
    p_order_id: order.id,
    p_attempt_number: attemptNumber,
    p_intent_id: intentId,
    p_stripe_reference: intentId,
    p_completed_at: new Date().toISOString(),
  });
  if (result.error) throw new Error(result.error.message);
}

async function markBillingSucceeded(input: {
  order: ClaimedBillingOrder;
  context: Awaited<ReturnType<typeof loadExecutionContext>>;
  intent: Stripe.PaymentIntent;
  attemptNumber: number;
}): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const completedAt = new Date().toISOString();
  const result = await supabase.rpc("finalize_billing_attempt_success", {
    p_order_id: input.order.id,
    p_attempt_number: input.attemptNumber,
    p_intent_id: input.intent.id,
    p_stripe_reference: stripePaymentIntentReference(input.intent),
    p_completed_at: completedAt,
  });
  if (result.error) throw new Error(result.error.message);
  if (finalizedExecutionState(result.data) !== "succeeded") {
    throw new Error("The successful Stripe payment was not finalized locally.");
  }
  await notifyAutomaticBillingResult({
    billingOrderId: input.order.id,
    membershipId: input.context.membership.id,
    homeownerId: input.context.homeowner.id,
    homeownerFirstName: input.context.homeowner.first_name,
    scheduledServiceAt: input.order.scheduled_service_at,
    outcome: "paid",
    amountCents: input.order.expected_charge_cents,
    attemptNumber: input.attemptNumber,
  });
}

async function markBillingFailed(input: {
  order: ClaimedBillingOrder;
  context: Awaited<ReturnType<typeof loadExecutionContext>>;
  error: unknown;
  intent: Stripe.PaymentIntent | null;
  attemptNumber: number;
  attemptedAt: string;
}): Promise<"paid" | "failed" | "needs_action" | "skipped"> {
  const knownIntentId =
    input.intent?.id ?? input.order.stripe_payment_intent_id;
  const ambiguousCreateOutcome =
    isRetryableStripeError(input.error) && !knownIntentId;
  // A transport failure is safe to retry only when Atlas already knows the
  // exact PaymentIntent to retrieve. If creation may have succeeded but its
  // response was lost, a later fresh create could double-charge after
  // Stripe's idempotency retention window; require reconciliation instead.
  const retryable =
    isRetryableStripeError(input.error) && Boolean(knownIntentId);
  const needsAction =
    !retryable &&
    (input.error instanceof Stripe.errors.StripeCardError ||
      paymentIntentNeedsAction(input.intent));
  const code = stripeErrorCode(input.error);
  const message = stripeErrorMessage(input.error);
  const retryAt = retryable
    ? automaticBillingRetryAt(new Date(input.attemptedAt), input.attemptNumber)
    : null;
  const supabase = createServiceRoleSupabaseClient();
  const completedAt = new Date().toISOString();
  const finalOutcome = ambiguousCreateOutcome
    ? "reconciliation_required"
    : retryAt
      ? "failed_retryable"
      : needsAction
        ? "needs_action"
        : "permanently_failed";
  if (ambiguousCreateOutcome) {
    await recordBillingReconciliationCase({
      billingOrderId: input.order.id,
      stripeObjectId: null,
      discrepancyType: "status_mismatch",
      evidence: {
        reason: "stripe_create_response_unknown",
        idempotency_key: input.order.idempotency_key,
        failure_code: code,
        failure_message: message,
      },
    });
  }
  const result = await supabase.rpc("finalize_billing_attempt_failure", {
    p_order_id: input.order.id,
    p_attempt_number: input.attemptNumber,
    p_outcome: finalOutcome,
    p_intent_id: knownIntentId,
    p_next_attempt_at: retryAt,
    p_failure_code: code,
    p_failure_message: message,
    p_completed_at: completedAt,
  });
  if (result.error) throw new Error(result.error.message);
  const finalState = finalizedExecutionState(result.data);
  if (!finalState) {
    throw new Error("The Stripe failure result was not finalized locally.");
  }
  // A success webhook can win the race while the request that created the
  // PaymentIntent is surfacing a stale transport/card error. Never overwrite
  // that success or send the customer a false payment-failure email.
  if (finalState === "succeeded") {
    await notifyAutomaticBillingResult({
      billingOrderId: input.order.id,
      membershipId: input.context.membership.id,
      homeownerId: input.context.homeowner.id,
      homeownerFirstName: input.context.homeowner.first_name,
      scheduledServiceAt: input.order.scheduled_service_at,
      outcome: "paid",
      amountCents: input.order.expected_charge_cents,
      attemptNumber: input.attemptNumber,
    });
    return "paid";
  }
  if (finalState === "void") return "skipped";
  if (finalState === "needs_action") {
    await notifyAutomaticBillingResult({
      billingOrderId: input.order.id,
      membershipId: input.context.membership.id,
      homeownerId: input.context.homeowner.id,
      homeownerFirstName: input.context.homeowner.first_name,
      scheduledServiceAt: input.order.scheduled_service_at,
      outcome: "needs_action",
      amountCents: input.order.expected_charge_cents,
      attemptNumber: input.attemptNumber,
    });
    return "needs_action";
  }
  return "failed";
}

async function markBillingReconciliationRequired(input: {
  order: ClaimedBillingOrder;
  context: Awaited<ReturnType<typeof loadExecutionContext>>;
  intent: Stripe.PaymentIntent;
  attemptNumber: number;
  issues: string[];
}): Promise<"paid" | "failed" | "skipped"> {
  const message = `Stripe PaymentIntent binding requires founder review: ${input.issues.join(", ")}`;
  await recordBillingReconciliationCase({
    billingOrderId: input.order.id,
    stripeObjectId: input.intent.id,
    discrepancyType: input.issues.some((issue) => issue.includes("amount"))
      ? "amount_mismatch"
      : "status_mismatch",
    evidence: {
      issues: input.issues,
      intent_status: input.intent.status,
      intent_livemode: input.intent.livemode,
    },
  });
  const supabase = createServiceRoleSupabaseClient();
  const result = await supabase.rpc("finalize_billing_attempt_failure", {
    p_order_id: input.order.id,
    p_attempt_number: input.attemptNumber,
    p_outcome: "reconciliation_required",
    p_intent_id:
      input.issues.includes("payment_intent_id_mismatch")
        ? input.order.stripe_payment_intent_id
        : input.intent.id,
    p_next_attempt_at: null,
    p_failure_code: "stripe_binding_mismatch",
    p_failure_message: message,
    p_completed_at: new Date().toISOString(),
  });
  if (result.error) throw new Error(result.error.message);
  const finalState = finalizedExecutionState(result.data);
  if (!finalState) {
    throw new Error("The reconciliation result was not finalized locally.");
  }
  if (finalState === "succeeded") {
    await notifyAutomaticBillingResult({
      billingOrderId: input.order.id,
      membershipId: input.context.membership.id,
      homeownerId: input.context.homeowner.id,
      homeownerFirstName: input.context.homeowner.first_name,
      scheduledServiceAt: input.order.scheduled_service_at,
      outcome: "paid",
      amountCents: input.order.expected_charge_cents,
      attemptNumber: input.attemptNumber,
    });
    return "paid";
  }
  if (finalState === "void") return "skipped";
  return "failed";
}

function automaticExecutionBlockers(input: {
  order: ClaimedBillingOrder;
  context: Awaited<ReturnType<typeof loadExecutionContext>>;
  settings: Awaited<ReturnType<typeof loadAutomaticBillingSettings>>;
  maxChargeCents: number;
}): string[] {
  const blockers = contextBlockingReasons({
    order: input.order,
    ...input.context,
    maxChargeCents: Math.min(
      input.maxChargeCents,
      input.settings.maxChargeCents,
    ),
  });
  if (!input.settings.enabled) blockers.push("global_billing_disabled");
  if (input.settings.executionMode !== "automatic") {
    blockers.push("global_billing_not_automatic");
  }
  if (!isCurrentStripeWebhookVerified(input.settings)) {
    blockers.push("stripe_webhook_not_verified_for_current_secret");
  }
  return blockers;
}

async function finalizeTruthRevalidationFailure(input: {
  order: ClaimedBillingOrder;
  context: Awaited<ReturnType<typeof loadExecutionContext>>;
  blockers: string[];
  completedAt: string;
}): Promise<"paid" | "skipped"> {
  const supabase = createServiceRoleSupabaseClient();
  // The claim already created a durable processing attempt. Finish that
  // attempt through the transactional RPC rather than trying to void an
  // in-flight row. A prior PaymentIntent can still settle asynchronously,
  // so keep provider-contacted work visible for reconciliation.
  const result = await supabase.rpc("finalize_billing_attempt_failure", {
    p_order_id: input.order.id,
    p_attempt_number: input.order.attempt_count,
    p_outcome: input.order.stripe_payment_intent_id
      ? "reconciliation_required"
      : "permanently_failed",
    p_intent_id: input.order.stripe_payment_intent_id,
    p_next_attempt_at: null,
    p_failure_code: "truth_revalidation_failed",
    p_failure_message: input.blockers.join(", "),
    p_completed_at: input.completedAt,
  });
  if (result.error) throw new Error(result.error.message);
  const finalState = finalizedExecutionState(result.data);
  if (finalState === "succeeded") {
    await notifyAutomaticBillingResult({
      billingOrderId: input.order.id,
      membershipId: input.context.membership.id,
      homeownerId: input.context.homeowner.id,
      homeownerFirstName: input.context.homeowner.first_name,
      scheduledServiceAt: input.order.scheduled_service_at,
      outcome: "paid",
      amountCents: input.order.expected_charge_cents,
      attemptNumber: input.order.attempt_count,
    });
    return "paid";
  }
  const event = await supabase.from("billing_order_events").insert({
    billing_order_id: input.order.id,
    event_type: "blocked",
    actor: "automatic_billing_truth_gate",
    reason: "Execution-time billing truth revalidation failed",
    event_data: { blockers: input.blockers },
  });
  if (event.error) throw new Error(event.error.message);
  return "skipped";
}

async function executeClaimedOrder(input: {
  order: ClaimedBillingOrder;
  triggerSource: AutomaticBillingTriggerSource;
  maxChargeCents: number;
}): Promise<"paid" | "failed" | "needs_action" | "skipped"> {
  let context = await loadExecutionContext(input.order);
  const latestSettings = await loadAutomaticBillingSettings();
  const attemptedAt = new Date().toISOString();
  const blockers = automaticExecutionBlockers({
    order: input.order,
    context,
    settings: latestSettings,
    maxChargeCents: input.maxChargeCents,
  });
  if (blockers.length > 0) {
    return finalizeTruthRevalidationFailure({
      order: input.order,
      context,
      blockers,
      completedAt: attemptedAt,
    });
  }

  const attemptNumber = input.order.attempt_count;
  const existingPaid = await upsertPendingCharge({
    order: input.order,
    context,
    attemptNumber,
    attemptedAt,
  });
  if (existingPaid) {
    await markAlreadyPaid(input.order, existingPaid, attemptNumber);
    return "skipped";
  }

  // Re-read every mutable authorization input immediately before Stripe.
  // A Jobber unlink, member pause, or global kill switch that landed after
  // the claim must stop provider contact, not merely be noticed afterward.
  try {
    const finalContext = await loadExecutionContext(input.order);
    const finalSettings = await loadAutomaticBillingSettings();
    const finalBlockers = automaticExecutionBlockers({
      order: input.order,
      context: finalContext,
      settings: finalSettings,
      maxChargeCents: input.maxChargeCents,
    });
    if (finalBlockers.length > 0) {
      return finalizeTruthRevalidationFailure({
        order: input.order,
        context: finalContext,
        blockers: finalBlockers,
        completedAt: new Date().toISOString(),
      });
    }
    context = finalContext;
  } catch (error) {
    return finalizeTruthRevalidationFailure({
      order: input.order,
      context,
      blockers: [
        "truth_context_reload_failed",
        error instanceof Error ? error.message.slice(0, 200) : "unknown",
      ],
      completedAt: new Date().toISOString(),
    });
  }

  const supabase = createServiceRoleSupabaseClient();
  const stripe = getStripe();
  let intent: Stripe.PaymentIntent | null = null;
  try {
    if (input.order.stripe_payment_intent_id) {
      intent = await stripe.paymentIntents.retrieve(
        input.order.stripe_payment_intent_id,
      );
      const retrievedBindingIssues = paymentIntentBindingIssues({
        order: input.order,
        context,
        intent,
      });
      if (retrievedBindingIssues.length > 0) {
        return markBillingReconciliationRequired({
          order: input.order,
          context,
          intent,
          attemptNumber,
          issues: retrievedBindingIssues,
        });
      }
      if (
        intent.status !== "succeeded" &&
        (intent.status === "requires_confirmation" ||
          (input.triggerSource === "founder_retry" &&
            intent.status === "requires_payment_method"))
      ) {
        intent = await stripe.paymentIntents.confirm(
          intent.id,
          {
            payment_method: context.membership.stripe_payment_method_id!,
            off_session: true,
          },
          {
            idempotencyKey: `${input.order.idempotency_key}:confirm:${attemptNumber}`,
          },
        );
      }
    } else {
      intent = await stripe.paymentIntents.create(
        {
          amount: input.order.expected_charge_cents,
          currency: "usd",
          customer: context.membership.stripe_customer_id!,
          payment_method: context.membership.stripe_payment_method_id!,
          confirm: true,
          off_session: true,
          description: `SqueegeeKing scheduled service - ${context.property.address}`,
          metadata: {
            homeatlas_billing_order_id: input.order.id,
            membership_id: input.order.membership_id,
            property_id: input.order.property_id,
            appointment_id: input.order.appointment_id,
            service_month: input.order.service_month,
          },
        },
        {
          idempotencyKey: `${input.order.idempotency_key}:payment-intent`,
        },
      );
    }
  } catch (error) {
    intent = errorPaymentIntent(error) ?? intent;
    if (intent) {
      const bindingIssues = paymentIntentBindingIssues({
        order: input.order,
        context,
        intent,
      });
      if (bindingIssues.length > 0) {
        return markBillingReconciliationRequired({
          order: input.order,
          context,
          intent,
          attemptNumber,
          issues: bindingIssues,
        });
      }
      // Stripe errors can carry the final PaymentIntent object. If that object
      // already succeeded, finalize success instead of letting a stale error
      // path label the customer unpaid. The webhook remains an idempotent
      // second path to the same result.
      if (intent.status === "succeeded") {
        await markBillingSucceeded({
          order: input.order,
          context,
          intent,
          attemptNumber,
        });
        return "paid";
      }
    }
    return markBillingFailed({
      order: input.order,
      context,
      error,
      intent,
      attemptNumber,
      attemptedAt,
    });
  }

  if (!intent) throw new Error("Stripe returned no PaymentIntent.");
  const bindingIssues = paymentIntentBindingIssues({
    order: input.order,
    context,
    intent,
  });
  if (bindingIssues.length > 0) {
    return markBillingReconciliationRequired({
      order: input.order,
      context,
      intent,
      attemptNumber,
      issues: bindingIssues,
    });
  }
  if (intent.status === "processing") {
    const retryAt = automaticBillingRetryAt(
      new Date(attemptedAt),
      attemptNumber,
    );
    if (!retryAt) {
      return markBillingReconciliationRequired({
        order: input.order,
        context,
        intent,
        attemptNumber,
        issues: ["stripe_processing_retry_limit_reached"],
      });
    }
    const result = await supabase.rpc("finalize_billing_attempt_failure", {
      p_order_id: input.order.id,
      p_attempt_number: attemptNumber,
      p_outcome: "failed_retryable",
      p_intent_id: intent.id,
      p_next_attempt_at: retryAt,
      p_failure_code: "stripe_payment_processing",
      p_failure_message:
        "Stripe is still processing the payment; Atlas will reconcile before any retry.",
      p_completed_at: new Date().toISOString(),
    });
    if (result.error) throw new Error(result.error.message);
    const finalState = finalizedExecutionState(result.data);
    if (!finalState) {
      throw new Error("The processing payment result was not finalized locally.");
    }
    if (finalState === "succeeded") {
      await notifyAutomaticBillingResult({
        billingOrderId: input.order.id,
        membershipId: context.membership.id,
        homeownerId: context.homeowner.id,
        homeownerFirstName: context.homeowner.first_name,
        scheduledServiceAt: input.order.scheduled_service_at,
        outcome: "paid",
        amountCents: input.order.expected_charge_cents,
        attemptNumber,
      });
      return "paid";
    }
    if (finalState === "void") return "skipped";
    return "failed";
  }
  if (intent.status !== "succeeded") {
    const statusError = new Error(
      `Stripe PaymentIntent ended in ${intent.status}.`,
    );
    return markBillingFailed({
      order: input.order,
      context,
      error: statusError,
      intent,
      attemptNumber,
      attemptedAt,
    });
  }
  await markBillingSucceeded({
    order: input.order,
    context,
    intent,
    attemptNumber,
  });
  return "paid";
}

async function finishRun(input: {
  runId: string;
  summary: AutomaticBillingRunSummary;
}): Promise<void> {
  const completedAt = new Date().toISOString();
  const supabase = createServiceRoleSupabaseClient();
  const result = await supabase
    .from("billing_automation_runs")
    .update({
      status: input.summary.status,
      candidate_count: input.summary.prepared?.eligible ?? 0,
      paid_count: input.summary.paid,
      failed_count: input.summary.failed + input.summary.needsAction,
      skipped_count: input.summary.skipped,
      summary: input.summary,
      completed_at: completedAt,
    })
    .eq("id", input.runId);
  if (result.error) throw new Error(result.error.message);
  await recordAutomaticBillingRunOnSettings({
    status: input.summary.status,
    summary: input.summary as unknown as Record<string, unknown>,
    completedAt,
  });
}

async function quarantineAmbiguousStaleAttempts(input: {
  serviceMonth: string;
  orderId?: string;
}): Promise<number> {
  const supabase = createServiceRoleSupabaseClient();
  const completedAt = new Date().toISOString();
  let query = supabase
    .from("billing_orders")
    .select("id, attempt_count, idempotency_key")
    .eq("service_month", input.serviceMonth)
    .eq("preview_state", "locked")
    .eq("execution_state", "processing")
    .is("stripe_payment_intent_id", null)
    .lte("lease_expires_at", completedAt);
  if (input.orderId) query = query.eq("id", input.orderId);
  const result = await query;
  if (result.error) throw new Error(result.error.message);
  let quarantined = 0;
  for (const order of result.data ?? []) {
    await recordBillingReconciliationCase({
      billingOrderId: order.id,
      stripeObjectId: null,
      discrepancyType: "status_mismatch",
      evidence: {
        reason: "processing_lease_expired_without_payment_intent_id",
        idempotency_key: order.idempotency_key,
      },
    });
    const finalized = await supabase.rpc(
      "finalize_billing_attempt_failure",
      {
        p_order_id: order.id,
        p_attempt_number: order.attempt_count,
        p_outcome: "reconciliation_required",
        p_intent_id: null,
        p_next_attempt_at: null,
        p_failure_code: "stripe_outcome_unknown_after_worker_loss",
        p_failure_message:
          "The worker stopped without recording a PaymentIntent. Atlas will not create another charge until the original outcome is reconciled.",
        p_completed_at: completedAt,
      },
    );
    if (finalized.error) throw new Error(finalized.error.message);
    if (finalizedExecutionState(finalized.data) !== "reconciliation_required") {
      continue;
    }
    const event = await supabase.from("billing_order_events").insert({
      billing_order_id: order.id,
      event_type: "blocked",
      actor: "automatic_billing_stale_attempt_guard",
      reason: "Unknown Stripe outcome after worker loss",
      event_data: { idempotency_key: order.idempotency_key },
    });
    if (event.error) throw new Error(event.error.message);
    quarantined += 1;
  }
  return quarantined;
}

async function voidStaleClaimCandidates(input: {
  serviceMonth: string;
  orderId?: string;
}): Promise<number> {
  const supabase = createServiceRoleSupabaseClient();
  let orderQuery = supabase
    .from("billing_orders")
    .select(
      "id, appointment_id, obligation_id, scheduled_service_at, execution_state, attempt_count, stripe_payment_intent_id",
    )
    .eq("service_month", input.serviceMonth)
    .eq("preview_state", "locked")
    .in("execution_state", ["pending", "failed_retryable"]);
  if (input.orderId) orderQuery = orderQuery.eq("id", input.orderId);
  const ordersResult = await orderQuery;
  if (ordersResult.error) throw new Error(ordersResult.error.message);
  const orders = (ordersResult.data ?? []) as Array<{
    id: string;
    appointment_id: string;
    obligation_id: string | null;
    scheduled_service_at: string;
    execution_state: string;
    attempt_count: number;
    stripe_payment_intent_id: string | null;
  }>;
  if (orders.length === 0) return 0;
  const appointmentsResult = await supabase
    .from("member_appointments")
    .select(
      "id, provider, external_id, scheduled_at, status, provenance_state, verification_state, match_state, matched_obligation_id",
    )
    .in("id", orders.map((order) => order.appointment_id));
  if (appointmentsResult.error) throw new Error(appointmentsResult.error.message);
  const appointmentById = new Map(
    ((appointmentsResult.data ?? []) as Array<{
      id: string;
      provider: string | null;
      external_id: string | null;
      scheduled_at: string;
      status: string;
      provenance_state: string;
      verification_state: string;
      match_state: string;
      matched_obligation_id: string | null;
    }>).map((appointment) => [appointment.id, appointment]),
  );
  let voided = 0;
  for (const order of orders) {
    const appointment = appointmentById.get(order.appointment_id);
    const valid = Boolean(
      appointment &&
        appointment.provider?.toLowerCase() === "jobber" &&
        appointment.external_id?.trim() &&
        appointment.status === "scheduled" &&
        ["provider_imported", "manually_verified"].includes(
          appointment.provenance_state,
        ) &&
        appointment.verification_state === "verified" &&
        appointment.match_state === "matched" &&
        appointment.scheduled_at === order.scheduled_service_at,
    );
    if (valid) continue;
    const failureMessage =
      "The verified Jobber visit changed before payment execution.";
    const safeUntouchedPending =
      order.execution_state === "pending" &&
      !order.stripe_payment_intent_id;
    let eventType = "blocked";
    if (safeUntouchedPending) {
      const update = await supabase
        .from("billing_orders")
        .update({
          preview_state: "void",
          execution_state: "void",
          locked_at: null,
          lease_owner: null,
          lease_expires_at: null,
          blocking_reasons: ["jobber_truth_changed_before_charge"],
          failure_code: "jobber_truth_changed",
          failure_message: failureMessage,
        })
        .eq("id", order.id)
        .eq("execution_state", "pending")
        .is("stripe_payment_intent_id", null)
        .select("id")
        .maybeSingle();
      if (update.error) throw new Error(update.error.message);
      if (!update.data) continue;
      eventType = "voided";
    } else {
      const finalized = await supabase.rpc(
        "finalize_billing_attempt_failure",
        {
          p_order_id: order.id,
          p_attempt_number: order.attempt_count,
          p_outcome: order.stripe_payment_intent_id
            ? "reconciliation_required"
            : "permanently_failed",
          p_intent_id: order.stripe_payment_intent_id,
          p_next_attempt_at: null,
          p_failure_code: "jobber_truth_changed",
          p_failure_message: failureMessage,
          p_completed_at: new Date().toISOString(),
        },
      );
      if (finalized.error) throw new Error(finalized.error.message);
      if (finalizedExecutionState(finalized.data) === "succeeded") continue;
    }
    const event = await supabase.from("billing_order_events").insert({
      billing_order_id: order.id,
      event_type: eventType,
      actor: "automatic_billing_preclaim_revalidation",
      reason: "Jobber scheduling truth changed before charge claim",
      event_data: {
        appointment_id: order.appointment_id,
        payment_intent_id: order.stripe_payment_intent_id,
      },
    });
    if (event.error) throw new Error(event.error.message);
    voided += 1;
  }
  return voided;
}

export async function runAutomaticMembershipBilling(input: {
  triggerSource: AutomaticBillingTriggerSource;
  actor: string;
  referenceDate?: Date;
  orderId?: string;
  stopClaimingAt?: number;
}): Promise<AutomaticBillingRunSummary> {
  const referenceDate = input.referenceDate ?? new Date();
  const settings = await loadAutomaticBillingSettings();
  const serviceMonth =
    automaticBillingServiceMonth(referenceDate) ??
    referenceDate.toISOString().slice(0, 7).concat("-01");
  const supabase = createServiceRoleSupabaseClient();
  const runResult = await supabase
    .from("billing_automation_runs")
    .insert({
      trigger_source: input.triggerSource,
      actor: input.actor,
      service_month: serviceMonth,
      status: settings.enabled ? "running" : "disabled",
    })
    .select("id")
    .single();
  if (runResult.error) throw new Error(runResult.error.message);
  const runId = runResult.data.id as string;
  const summary: AutomaticBillingRunSummary = {
    runId,
    status: settings.enabled ? "succeeded" : "disabled",
    serviceMonth,
    executionMode: settings.executionMode,
    firstBusinessDay: isFirstBusinessDay(referenceDate),
    prepared: null,
    claimed: 0,
    paid: 0,
    failed: 0,
    needsAction: 0,
    skipped: 0,
    deferred: false,
  };

  try {
    if (input.triggerSource === "founder_manual") {
      summary.status = "succeeded";
      summary.executionMode = "shadow";
      summary.prepared = await prepareAutomaticBillingOrders({
        settings: {
          ...settings,
          enabled: true,
          executionMode: "shadow",
        },
        referenceDate,
      });
      await finishRun({ runId, summary });
      return summary;
    }
    if (!settings.enabled) {
      await finishRun({ runId, summary });
      return summary;
    }
    if (!isStripeLiveMode()) {
      throw new Error("Automatic billing requires matching live Stripe keys.");
    }
    const webhookFingerprint = currentStripeWebhookSecretFingerprint();
    if (!webhookFingerprint || !isCurrentStripeWebhookVerified(settings)) {
      throw new Error(
        "Automatic billing requires a signed Stripe webhook delivery for the current endpoint secret.",
      );
    }
    summary.prepared = await prepareAutomaticBillingOrders({
      settings,
      referenceDate,
    });
    if (settings.executionMode !== "automatic" && !input.orderId) {
      await finishRun({ runId, summary });
      return summary;
    }

    summary.failed += await quarantineAmbiguousStaleAttempts({
      serviceMonth,
      orderId: input.orderId,
    });
    summary.skipped += await voidStaleClaimCandidates({
      serviceMonth,
      orderId: input.orderId,
    });
    const leaseOwner = `${input.triggerSource}:${runId}:${randomUUID()}`;
    // Claim exactly one order at a time. If the worker reaches its execution
    // budget, no untouched members are left under a lease and the later
    // first-day run can safely continue the queue.
    while (true) {
      if (
        !input.orderId &&
        input.stopClaimingAt !== undefined &&
        Date.now() >= input.stopClaimingAt
      ) {
        summary.deferred = true;
        break;
      }
      const claimResult = await supabase.rpc("claim_due_billing_orders", {
        p_lease_owner: leaseOwner,
        p_trigger_source: input.triggerSource,
        p_service_month: serviceMonth,
        p_webhook_secret_fingerprint: webhookFingerprint,
        p_now: new Date().toISOString(),
        p_limit: 1,
        p_order_id: input.orderId ?? null,
      });
      if (claimResult.error) throw new Error(claimResult.error.message);
      const orders = (claimResult.data ?? []) as ClaimedBillingOrder[];
      if (orders.length === 0) break;
      summary.claimed += orders.length;
      for (const order of orders) {
        try {
          const outcome = await executeClaimedOrder({
            order,
            triggerSource: input.triggerSource,
            maxChargeCents: settings.maxChargeCents,
          });
          if (outcome === "paid") summary.paid += 1;
          else if (outcome === "needs_action") summary.needsAction += 1;
          else if (outcome === "failed") summary.failed += 1;
          else summary.skipped += 1;
        } catch (error) {
          summary.failed += 1;
          console.error("[automatic-billing] order execution failed", {
            orderId: order.id,
            reason: error instanceof Error ? error.message : "unknown",
          });
        }
      }
      if (input.orderId) break;
    }
    summary.status =
      summary.failed > 0 || summary.needsAction > 0 ? "partial" : "succeeded";
    await finishRun({ runId, summary });
    return summary;
  } catch (error) {
    summary.status = "failed";
    await finishRun({ runId, summary }).catch(() => undefined);
    throw error;
  }
}
