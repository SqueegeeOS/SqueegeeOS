import "server-only";

import { createHash } from "node:crypto";
import { formatBusinessCalendarDate, zonedDateTimeToUtc } from "@/lib/admin/company-business-timezone";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { JOBBER_CONNECTION_ID } from "@/lib/care-operations/jobber-oauth-config";
import {
  membershipBillingAuthorizationIssues,
  type MembershipBillingAuthorizationInput,
} from "./membership-billing-authorization";
import {
  automaticBillingBlockingReasons,
  automaticJobberBillingOperationKey,
  automaticBillingMonthBounds,
  dollarsToBillingCents,
  type AutomaticBillingAppointmentInput,
  type AutomaticBillingMembershipInput,
} from "./automatic-billing-rules";
import { jobberScheduledChargeDecision } from "./jobber-scheduled-charge";
import {
  isFirstBusinessDay,
  type AutomaticBillingSettings,
} from "./automatic-billing-settings";

interface MembershipRow {
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

interface AppointmentRow {
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

interface AgreementRow {
  id: string;
  status: string;
  membership_id: string | null;
  property_id: string | null;
  billing_authorization_version: string | null;
  billing_authorized_at: string | null;
  authorized_visit_price_cents: number | null;
  billing_terms_hash: string | null;
}

interface JobberProjectionRow {
  connection_id: string;
  external_visit_id: string;
  external_job_id: string;
  external_property_id: string;
  scheduled_start: string | null;
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

interface BillingOrderRow {
  id: string;
  membership_id: string;
  obligation_id: string | null;
  appointment_id: string;
  service_month: string;
  scheduled_service_at: string;
  amount_cents: number;
  preview_state: string;
  execution_state: string;
  stripe_payment_intent_id: string | null;
  input_fingerprint: string;
}

interface JobberPropertyLinkRow {
  connection_id: string;
  external_property_id: string;
  membership_id: string;
  property_id: string;
  link_state: "active" | "revoked";
}

export interface AutomaticBillingPreparationSummary {
  serviceMonth: string;
  appointments: number;
  eligible: number;
  created: number;
  locked: number;
  shadowed: number;
  blocked: number;
  alreadyPrepared: number;
  blockedReasons: Record<string, number>;
}

function incrementReason(summary: AutomaticBillingPreparationSummary, reason: string) {
  summary.blocked += 1;
  summary.blockedReasons[reason] = (summary.blockedReasons[reason] ?? 0) + 1;
}

function authorizationInput(
  row: MembershipRow,
  agreement: AgreementRow | null,
): MembershipBillingAuthorizationInput {
  const currentVisitPriceCents =
    row.visit_price === null
      ? null
      : dollarsToBillingCents(Number(row.visit_price));
  return {
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
  };
}

function membershipInput(
  row: MembershipRow,
  agreement: AgreementRow | null,
): AutomaticBillingMembershipInput {
  return {
    id: row.id,
    status: row.status,
    agreementId: row.agreement_id,
    paymentSetupCompletedAt: row.payment_setup_completed_at,
    stripeCustomerId: row.stripe_customer_id,
    stripePaymentMethodId: row.stripe_payment_method_id,
    visitPrice: row.visit_price === null ? null : Number(row.visit_price),
    automaticBillingEnabled: row.automatic_billing_enabled,
    billingAuthorizationIssues: membershipBillingAuthorizationIssues(
      authorizationInput(row, agreement),
    ),
  };
}

function appointmentInput(
  row: AppointmentRow,
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

function pricingFingerprint(input: {
  membership: MembershipRow;
  appointment: AppointmentRow;
  projection: JobberProjectionRow;
  billingUnitKey: string;
  amountCents: number;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        membershipId: input.membership.id,
        agreementId: input.membership.agreement_id,
        appointmentId: input.appointment.id,
        externalVisitId: input.appointment.external_id,
        scheduledAt: input.appointment.scheduled_at,
        externalJobId: input.projection.external_job_id,
        jobberSourcePayloadHash: input.projection.source_payload_hash,
        billingUnitKey: input.billingUnitKey,
        amountCents: input.amountCents,
      }),
    )
    .digest("hex");
}

function isActiveOrder(
  row: Pick<BillingOrderRow, "preview_state" | "execution_state">,
): boolean {
  return row.preview_state !== "void" && row.execution_state !== "void";
}

function isSafeToVoidBeforePaymentContact(
  row: Pick<
    BillingOrderRow,
    "execution_state" | "stripe_payment_intent_id"
  >,
): boolean {
  return (
    !row.stripe_payment_intent_id &&
    ["disabled", "pending"].includes(row.execution_state)
  );
}

export function shouldVoidOrderMissingFromScheduledVisits(
  order: Pick<
    BillingOrderRow,
    | "appointment_id"
    | "preview_state"
    | "execution_state"
    | "stripe_payment_intent_id"
  >,
  scheduledAppointmentIds: ReadonlySet<string>,
): boolean {
  return (
    isActiveOrder(order) &&
    isSafeToVoidBeforePaymentContact(order) &&
    !scheduledAppointmentIds.has(order.appointment_id)
  );
}


async function voidStaleOrders(
  appointment: AppointmentRow,
  orders: BillingOrderRow[],
  expectedFingerprint: string,
): Promise<boolean> {
  const stale = orders.filter(
    (order) =>
      order.appointment_id === appointment.id &&
      isActiveOrder(order) &&
      (order.scheduled_service_at !== appointment.scheduled_at ||
        order.input_fingerprint !== expectedFingerprint),
  );
  if (stale.some((order) => !isSafeToVoidBeforePaymentContact(order))) {
    return false;
  }
  if (stale.length === 0) return true;
  const supabase = createServiceRoleSupabaseClient();
  for (const order of stale) {
    const result = await supabase
      .from("billing_orders")
      .update({
        preview_state: "void",
        execution_state: "void",
        locked_at: null,
        blocking_reasons: ["jobber_scheduled_service_or_price_changed"],
        lease_owner: null,
        lease_expires_at: null,
      })
      .eq("id", order.id)
      .in("execution_state", ["disabled", "pending"])
      .is("stripe_payment_intent_id", null)
      .select("id")
      .maybeSingle();
    if (result.error) throw new Error(result.error.message);
    if (!result.data) return false;
    const event = await supabase.from("billing_order_events").insert({
      billing_order_id: order.id,
      event_type: "voided",
      actor: "automatic_billing_truth_gate",
      reason: "Verified Jobber service timing or price changed before Stripe contact",
      event_data: {
        scheduled_at: appointment.scheduled_at,
        input_fingerprint: expectedFingerprint,
      },
    });
    if (event.error) throw new Error(event.error.message);
    order.preview_state = "void";
    order.execution_state = "void";
  }
  return true;
}

async function voidOrdersMissingFromScheduledVisits(input: {
  orders: BillingOrderRow[];
  scheduledAppointmentIds: Set<string>;
}): Promise<void> {
  const stale = input.orders.filter(
    (order) =>
      shouldVoidOrderMissingFromScheduledVisits(
        order,
        input.scheduledAppointmentIds,
      ),
  );
  if (stale.length === 0) return;
  const supabase = createServiceRoleSupabaseClient();
  for (const order of stale) {
    const result = await supabase
      .from("billing_orders")
      .update({
        preview_state: "void",
        execution_state: "void",
        locked_at: null,
        blocking_reasons: ["jobber_visit_no_longer_scheduled"],
        lease_owner: null,
        lease_expires_at: null,
        failure_code: "jobber_visit_no_longer_scheduled",
        failure_message:
          "The Jobber visit used to prepare this order is no longer scheduled.",
      })
      .eq("id", order.id)
      .in("execution_state", ["disabled", "pending"])
      .is("stripe_payment_intent_id", null)
      .select("id")
      .maybeSingle();
    if (result.error) throw new Error(result.error.message);
    if (!result.data) continue;
    const event = await supabase.from("billing_order_events").insert({
      billing_order_id: order.id,
      event_type: "voided",
      actor: "automatic_billing_truth_gate",
      reason: "The Jobber visit is no longer in the current scheduled set",
      event_data: { appointment_id: order.appointment_id },
    });
    if (event.error) throw new Error(event.error.message);
    order.preview_state = "void";
    order.execution_state = "void";
  }
}

function jobberPropertyPricingIsVerified(input: {
  appointment: AppointmentRow;
  membership: MembershipRow;
  projection: JobberProjectionRow | null;
  link: JobberPropertyLinkRow | null;
}): boolean {
  return Boolean(
    input.projection &&
      input.link &&
      input.projection.external_visit_id === input.appointment.external_id &&
      input.projection.scheduled_start === input.appointment.scheduled_at &&
      input.projection.match_state === "matched" &&
      input.projection.matched_property_id === input.membership.property_id &&
      input.link.link_state === "active" &&
      input.link.connection_id === input.projection.connection_id &&
      input.link.external_property_id ===
        input.projection.external_property_id &&
      input.link.membership_id === input.membership.id &&
      input.link.property_id === input.membership.property_id,
  );
}

async function lockExistingOrder(input: {
  order: BillingOrderRow;
  settings: AutomaticBillingSettings;
  referenceDate: Date;
}): Promise<boolean> {
  if (
    input.settings.executionMode !== "automatic" ||
    !isFirstBusinessDay(input.referenceDate) ||
    input.order.preview_state === "locked" ||
    input.order.amount_cents > input.settings.maxChargeCents
  ) {
    return false;
  }
  const now = input.referenceDate.toISOString();
  const dueAt = zonedDateTimeToUtc(
    input.order.service_month,
    0,
    0,
    0,
  ).toISOString();
  const supabase = createServiceRoleSupabaseClient();
  const result = await supabase
    .from("billing_orders")
    .update({
      preview_state: "locked",
      execution_state: "pending",
      locked_at: now,
      approved_by: "automatic_billing_truth_gate",
      approved_at: now,
      due_at: dueAt,
      next_attempt_at: now,
      blocking_reasons: [],
    })
    .eq("id", input.order.id)
    .in("preview_state", ["ready", "draft"])
    .select("id")
    .maybeSingle();
  if (result.error) throw new Error(result.error.message);
  if (!result.data) return false;
  const event = await supabase.from("billing_order_events").insert({
    billing_order_id: input.order.id,
    event_type: "locked",
    actor: "automatic_billing_truth_gate",
    reason: "First-day automatic billing truth checks passed",
    event_data: { due_at: dueAt, max_charge_cents: input.settings.maxChargeCents },
  });
  if (event.error) {
    await supabase
      .from("billing_orders")
      .update({
        preview_state: "ready",
        execution_state: "disabled",
        locked_at: null,
        approved_by: null,
        approved_at: null,
        due_at: null,
        next_attempt_at: null,
        blocking_reasons: ["billing_audit_event_write_failed"],
      })
      .eq("id", input.order.id);
    throw new Error(event.error.message);
  }
  return true;
}

export async function prepareAutomaticBillingOrders(input: {
  settings: AutomaticBillingSettings;
  referenceDate?: Date;
}): Promise<AutomaticBillingPreparationSummary> {
  const referenceDate = input.referenceDate ?? new Date();
  const bounds = automaticBillingMonthBounds(referenceDate);
  const summary: AutomaticBillingPreparationSummary = {
    serviceMonth: bounds.serviceMonth,
    appointments: 0,
    eligible: 0,
    created: 0,
    locked: 0,
    shadowed: 0,
    blocked: 0,
    alreadyPrepared: 0,
    blockedReasons: {},
  };
  if (!input.settings.enabled) return summary;

  const supabase = createServiceRoleSupabaseClient();
  const appointmentsResult = await supabase
    .from("member_appointments")
    .select(
      "id, property_id, provider, external_id, scheduled_at, status, provenance_state, verification_state, match_state, matched_obligation_id",
    )
    .eq("provider", "jobber")
    .eq("status", "scheduled")
    .eq("verification_state", "verified")
    .eq("match_state", "matched")
    .gte("scheduled_at", bounds.startUtc.toISOString())
    .lt("scheduled_at", bounds.endUtc.toISOString())
    .order("scheduled_at", { ascending: true });
  if (appointmentsResult.error) throw new Error(appointmentsResult.error.message);
  const appointments = (appointmentsResult.data ?? []) as AppointmentRow[];
  summary.appointments = appointments.length;

  // Load every order for the service month before the early return. If Jobber
  // cancels the only visit in a month, there is no appointment row left to lead
  // us back to the old order; that old order must still be made inert.
  const ordersResult = await supabase
    .from("billing_orders")
    .select(
      "id, membership_id, obligation_id, appointment_id, service_month, scheduled_service_at, amount_cents, preview_state, execution_state, stripe_payment_intent_id, input_fingerprint",
    )
    .eq("service_month", bounds.serviceMonth);
  if (ordersResult.error) throw new Error(ordersResult.error.message);
  const orders = (ordersResult.data ?? []) as BillingOrderRow[];
  await voidOrdersMissingFromScheduledVisits({
    orders,
    scheduledAppointmentIds: new Set(appointments.map((row) => row.id)),
  });
  if (appointments.length === 0) return summary;

  const propertyIds = [...new Set(appointments.map((row) => row.property_id))];
  const membershipsResult = await supabase
    .from("memberships")
    .select(
      "id, homeowner_id, property_id, status, billing_schedule, agreement_id, payment_setup_completed_at, stripe_customer_id, stripe_payment_method_id, visit_price, automatic_billing_enabled",
    )
    .in("property_id", propertyIds)
    .eq("status", "active");
  if (membershipsResult.error) throw new Error(membershipsResult.error.message);
  const memberships = (membershipsResult.data ?? []) as MembershipRow[];
  const membershipByProperty = new Map(
    memberships.map((membership) => [membership.property_id, membership]),
  );
  const agreementIds = memberships
    .map((row) => row.agreement_id)
    .filter((id): id is string => Boolean(id));
  const externalVisitIds = appointments
    .map((row) => row.external_id)
    .filter((id): id is string => Boolean(id?.trim()));
  const [agreementsResult, projectionsResult] = await Promise.all([
    agreementIds.length
      ? supabase
          .from("signed_agreements")
          .select(
            "id, status, membership_id, property_id, billing_authorization_version, billing_authorized_at, authorized_visit_price_cents, billing_terms_hash",
          )
          .in("id", agreementIds)
      : Promise.resolve({ data: [], error: null }),
    externalVisitIds.length
      ? supabase
          .from("jobber_visit_projections")
          .select(
            "connection_id, external_visit_id, external_job_id, external_property_id, scheduled_start, source_payload_hash, title, job_type, job_billing_type, job_total_cents, job_will_auto_charge, visit_invoice_id, visit_invoice_status, is_last_scheduled_visit, match_state, matched_property_id",
          )
          .eq("connection_id", JOBBER_CONNECTION_ID)
          .in("external_visit_id", externalVisitIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (agreementsResult.error) throw new Error(agreementsResult.error.message);
  if (projectionsResult.error) throw new Error(projectionsResult.error.message);
  const agreements = (agreementsResult.data ?? []) as AgreementRow[];
  const agreementById = new Map(agreements.map((row) => [row.id, row]));
  const projections = (projectionsResult.data ?? []) as JobberProjectionRow[];
  const projectionByVisitId = new Map(
    projections.map((row) => [row.external_visit_id, row]),
  );
  const externalPropertyIds = [
    ...new Set(projections.map((row) => row.external_property_id)),
  ];
  const linksResult = externalPropertyIds.length
    ? await supabase
        .from("jobber_property_links")
        .select(
          "connection_id, external_property_id, membership_id, property_id, link_state",
        )
        .eq("connection_id", JOBBER_CONNECTION_ID)
        .eq("link_state", "active")
        .in("external_property_id", externalPropertyIds)
    : { data: [], error: null };
  if (linksResult.error) throw new Error(linksResult.error.message);
  const propertyLinkByExternalPropertyAndMembership = new Map(
    ((linksResult.data ?? []) as JobberPropertyLinkRow[]).map((row) => [
      `${row.external_property_id}:${row.membership_id}`,
      row,
    ]),
  );
  const firstVisitByJob = new Map<string, string>();
  for (const projection of [...projections].sort((left, right) =>
    (left.scheduled_start ?? "").localeCompare(right.scheduled_start ?? ""),
  )) {
    if (!firstVisitByJob.has(projection.external_job_id)) {
      firstVisitByJob.set(projection.external_job_id, projection.external_visit_id);
    }
  }

  for (const appointment of appointments) {
    const membership = membershipByProperty.get(appointment.property_id);
    if (!membership) {
      incrementReason(summary, "active_membership_not_found");
      continue;
    }
    if (membership.billing_schedule !== "first_of_service_month") {
      incrementReason(summary, "billing_schedule_not_supported");
      continue;
    }
    const agreement = membership.agreement_id
      ? agreementById.get(membership.agreement_id) ?? null
      : null;
    const projection =
      projectionByVisitId.get(appointment.external_id ?? "") ?? null;
    const propertyLink = projection
      ? propertyLinkByExternalPropertyAndMembership.get(
          `${projection.external_property_id}:${membership.id}`,
        ) ?? null
      : null;
    const jobberBillingVerified = jobberPropertyPricingIsVerified({
      appointment,
      membership,
      projection,
      link: propertyLink,
    });
    const pricingDecision = projection
      ? jobberScheduledChargeDecision({
          externalJobId: projection.external_job_id,
          externalVisitId: projection.external_visit_id,
          jobType: projection.job_type,
          billingType: projection.job_billing_type,
          jobTotalCents: projection.job_total_cents,
          jobWillAutoCharge: projection.job_will_auto_charge,
          visitInvoiceId: projection.visit_invoice_id,
          visitInvoiceStatus: projection.visit_invoice_status,
          isLastScheduledVisit: projection.is_last_scheduled_visit,
          isFirstVisitForJobInServiceMonth:
            firstVisitByJob.get(projection.external_job_id) ===
            projection.external_visit_id,
          serviceMonth: bounds.serviceMonth,
        })
      : null;
    const blockers = automaticBillingBlockingReasons({
      membership: membershipInput(membership, agreement),
      appointment: appointmentInput(
        appointment,
        jobberBillingVerified && Boolean(pricingDecision?.eligible),
      ),
      serviceMonth: bounds.serviceMonth,
    });
    if (!projection) blockers.push("jobber_projection_missing");
    if (!propertyLink) blockers.push("jobber_property_not_paired");
    if (pricingDecision && !pricingDecision.eligible) {
      blockers.push(...pricingDecision.blockers);
    }
    if (blockers.length > 0) {
      incrementReason(summary, [...new Set(blockers)].join(","));
      continue;
    }
    const amountCents = pricingDecision!.amountCents!;
    const billingUnitKey = pricingDecision!.billingUnitKey!;
    if (amountCents > input.settings.maxChargeCents) {
      incrementReason(summary, "charge_above_founder_cap");
      continue;
    }
    const fingerprint = pricingFingerprint({
      membership,
      appointment,
      projection: projection!,
      billingUnitKey,
      amountCents,
    });
    if (!(await voidStaleOrders(appointment, orders, fingerprint))) {
      incrementReason(summary, "paid_or_processing_jobber_charge_changed");
      continue;
    }
    summary.eligible += 1;
    const activeOrder = orders.find(
      (order) =>
        isActiveOrder(order) &&
        order.appointment_id === appointment.id &&
        order.input_fingerprint === fingerprint,
    );
    if (activeOrder) {
      summary.alreadyPrepared += 1;
      if (
        await lockExistingOrder({
          order: activeOrder,
          settings: input.settings,
          referenceDate,
        })
      ) {
        summary.locked += 1;
      }
      continue;
    }

    const snapshotResult = await supabase
      .from("atlas_pricing_snapshots")
      .insert({
        engine_version: "jobber-scheduled-services-v2",
        company_settings_version: `agreement:${membership.agreement_id}`,
        company_settings_hash: fingerprint,
        normalized_inputs: {
          source: "jobber_scheduled_service_price",
          membership_id: membership.id,
          agreement_id: membership.agreement_id,
          external_job_id: projection!.external_job_id,
          external_visit_id: projection!.external_visit_id,
          jobber_source_payload_hash: projection!.source_payload_hash,
          billing_unit_key: billingUnitKey,
          charge_kind: pricingDecision!.chargeKind,
          job_total_cents: amountCents,
        },
        line_item_output: [
          {
            kind: pricingDecision!.chargeKind,
            description:
              projection!.title ?? "Scheduled SqueegeeKing Jobber service",
            amount_cents: amountCents,
          },
        ],
        authorized_charge_cents: amountCents,
        membership_id: membership.id,
        obligation_id: null,
        property_id: membership.property_id,
      })
      .select("id")
      .single();
    if (snapshotResult.error) throw new Error(snapshotResult.error.message);

    const shouldLock =
      input.settings.executionMode === "automatic" &&
      isFirstBusinessDay(referenceDate);
    const now = referenceDate.toISOString();
    const dueAt = zonedDateTimeToUtc(bounds.serviceMonth, 0, 0, 0).toISOString();
    const orderResult = await supabase
      .from("billing_orders")
      .insert({
        membership_id: membership.id,
        property_id: membership.property_id,
        obligation_id: null,
        appointment_id: appointment.id,
        pricing_snapshot_id: snapshotResult.data.id,
        service_month: bounds.serviceMonth,
        scheduled_service_at: appointment.scheduled_at,
        amount_cents: amountCents,
        credit_applied_cents: 0,
        expected_charge_cents: amountCents,
        stripe_customer_ready: true,
        stripe_payment_method_ready: true,
        preview_state: shouldLock ? "locked" : "ready",
        execution_state: shouldLock ? "pending" : "disabled",
        blocking_reasons: shouldLock
          ? []
          : [
              isFirstBusinessDay(referenceDate)
                ? "founder_approval_or_automatic_mode_required"
                : "discovered_after_first_of_service_month",
            ],
        input_fingerprint: fingerprint,
        idempotency_key: automaticJobberBillingOperationKey(
          membership.id,
          bounds.serviceMonth,
          billingUnitKey,
        ),
        due_at: shouldLock ? dueAt : null,
        next_attempt_at: shouldLock ? now : null,
        locked_at: shouldLock ? now : null,
        approved_by: shouldLock ? "automatic_billing_truth_gate" : null,
        approved_at: shouldLock ? now : null,
      })
      .select("id")
      .single();
    if (orderResult.error) {
      if (orderResult.error.code === "23505") {
        summary.alreadyPrepared += 1;
        continue;
      }
      throw new Error(orderResult.error.message);
    }
    summary.created += 1;
    if (shouldLock) summary.locked += 1;
    else summary.shadowed += 1;
    const events = [
      {
        billing_order_id: orderResult.data.id,
        event_type: "created",
        actor: "automatic_billing_truth_gate",
        reason: "Built from standing authorization and verified Jobber price",
        event_data: {
          fingerprint,
          external_job_id: projection!.external_job_id,
          external_visit_id: projection!.external_visit_id,
          charge_kind: pricingDecision!.chargeKind,
        },
      },
      {
        billing_order_id: orderResult.data.id,
        event_type: shouldLock ? "locked" : "ready",
        actor: "automatic_billing_truth_gate",
        reason: shouldLock
          ? "First-day automatic billing truth checks passed"
          : "Prepared for founder review; no charge authorized",
        event_data: {
          service_date: formatBusinessCalendarDate(
            new Date(appointment.scheduled_at),
          ),
          amount_cents: amountCents,
        },
      },
    ];
    const eventsResult = await supabase.from("billing_order_events").insert(events);
    if (eventsResult.error) {
      await supabase
        .from("billing_orders")
        .update({
          preview_state: "void",
          execution_state: "void",
          locked_at: null,
          lease_owner: null,
          lease_expires_at: null,
          blocking_reasons: ["billing_audit_event_write_failed"],
        })
        .eq("id", orderResult.data.id);
      throw new Error(eventsResult.error.message);
    }
  }

  return summary;
}
