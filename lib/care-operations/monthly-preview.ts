import "server-only";

import { createPrivilegedServerSupabaseClient } from "@/lib/persistence/supabase/client";
import { buildBillingPreview } from "./billing-preview";
import type { AppointmentProvenance } from "./model";

export interface MonthlyPreviewRow {
  billingOrderId: string;
  obligationId: string;
  appointmentId: string;
  membershipId: string;
  propertyId: string;
  propertyAddress: string | null;
  homeownerName: string | null;
  serviceMonth: string;
  scheduledServiceAt: string;
  provider: string | null;
  externalId: string | null;
  pricingSnapshotId: string;
  pricingEngineVersion: string | null;
  companySettingsVersion: string | null;
  amountCents: number;
  creditAppliedCents: number;
  expectedChargeCents: number;
  stripeCustomerReady: boolean;
  stripePaymentMethodReady: boolean;
  billable: boolean;
  blockingReasons: string[];
  executionEnabled: false;
}

interface OrderRow {
  id: string;
  membership_id: string;
  property_id: string;
  obligation_id: string;
  appointment_id: string;
  pricing_snapshot_id: string;
  service_month: string;
  scheduled_service_at: string;
  amount_cents: number;
  credit_applied_cents: number;
  stripe_customer_ready: boolean;
  stripe_payment_method_ready: boolean;
}

interface AppointmentRow {
  id: string;
  property_id: string;
  matched_obligation_id: string | null;
  scheduled_at: string;
  provider: string | null;
  external_id: string | null;
  provenance_state: AppointmentProvenance["provenanceState"];
  verification_state: AppointmentProvenance["verificationState"];
  match_state: AppointmentProvenance["matchState"];
}

interface SnapshotRow {
  id: string;
  engine_version: string;
  company_settings_version: string;
  authorized_charge_cents: number;
  override_amount_cents: number | null;
  membership_id: string;
  obligation_id: string;
  property_id: string;
}

interface MembershipRow {
  id: string;
  property_id: string;
  homeowner_id: string;
  stripe_customer_id: string | null;
  stripe_payment_method_id: string | null;
}

interface ObligationRow {
  id: string;
  membership_id: string;
  property_id: string;
}

interface PropertyRow { id: string; address: string | null }
interface HomeownerRow { id: string; full_name: string | null }

export function normalizeServiceMonth(value: string): string | null {
  const match = /^(\d{4})-(\d{2})(?:-01)?$/.exec(value.trim());
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return `${match[1]}-${match[2]}-01`;
}

export function projectMonthlyPreviewRow(input: {
  order: OrderRow;
  appointment: AppointmentRow | undefined;
  snapshot: SnapshotRow | undefined;
  membership: MembershipRow | undefined;
  obligation: ObligationRow | undefined;
  property: PropertyRow | undefined;
  homeowner: HomeownerRow | undefined;
}): MonthlyPreviewRow {
  const appointment: AppointmentProvenance = input.appointment
    ? {
        provider: input.appointment.provider,
        externalId: input.appointment.external_id,
        provenanceState: input.appointment.provenance_state,
        verificationState: input.appointment.verification_state,
        matchState: input.appointment.match_state,
      }
    : {
        provider: null,
        externalId: null,
        provenanceState: "homeatlas_legacy_unverified",
        verificationState: "unverified",
        matchState: "manual_review",
      };
  const stripeCustomerReady = Boolean(input.membership?.stripe_customer_id);
  const stripePaymentMethodReady = Boolean(input.membership?.stripe_payment_method_id);
  const effectiveSnapshotAmount = input.snapshot
    ? input.snapshot.override_amount_cents ?? input.snapshot.authorized_charge_cents
    : null;
  const preview = buildBillingPreview({
    obligationId: input.order.obligation_id,
    appointmentId: input.order.appointment_id,
    appointment,
    pricingSnapshotId: input.snapshot?.id ?? null,
    authorizedChargeCents: effectiveSnapshotAmount,
    creditAppliedCents: input.order.credit_applied_cents,
    stripeCustomerReady,
    stripePaymentMethodReady,
    serviceMonth: input.order.service_month,
    scheduledServiceAt: input.order.scheduled_service_at,
  });
  const reasons = [...preview.blockingReasons];
  if (!input.appointment) reasons.push("appointment_record_missing");
  if (!input.snapshot) reasons.push("pricing_snapshot_record_missing");
  if (!input.membership) reasons.push("membership_record_missing");
  if (!input.obligation) reasons.push("obligation_record_missing");
  if (input.membership && input.membership.property_id !== input.order.property_id) {
    reasons.push("membership_property_mismatch");
  }
  if (input.obligation && input.obligation.membership_id !== input.order.membership_id) {
    reasons.push("obligation_membership_mismatch");
  }
  if (input.obligation && input.obligation.property_id !== input.order.property_id) {
    reasons.push("obligation_property_mismatch");
  }
  if (input.appointment && input.appointment.property_id !== input.order.property_id) {
    reasons.push("appointment_property_mismatch");
  }
  if (input.appointment && input.appointment.matched_obligation_id !== input.order.obligation_id) {
    reasons.push("appointment_obligation_mismatch");
  }
  if (input.appointment && input.appointment.scheduled_at !== input.order.scheduled_service_at) {
    reasons.push("order_visit_time_mismatch");
  }
  if (input.snapshot && input.snapshot.membership_id !== input.order.membership_id) {
    reasons.push("snapshot_membership_mismatch");
  }
  if (input.snapshot && input.snapshot.obligation_id !== input.order.obligation_id) {
    reasons.push("snapshot_obligation_mismatch");
  }
  if (input.snapshot && input.snapshot.property_id !== input.order.property_id) {
    reasons.push("snapshot_property_mismatch");
  }
  if (effectiveSnapshotAmount !== null && effectiveSnapshotAmount !== input.order.amount_cents) {
    reasons.push("order_snapshot_amount_mismatch");
  }

  return {
    billingOrderId: input.order.id,
    obligationId: input.order.obligation_id,
    appointmentId: input.order.appointment_id,
    membershipId: input.order.membership_id,
    propertyId: input.order.property_id,
    propertyAddress: input.property?.address ?? null,
    homeownerName: input.homeowner?.full_name ?? null,
    serviceMonth: input.order.service_month,
    scheduledServiceAt: input.order.scheduled_service_at,
    provider: appointment.provider,
    externalId: appointment.externalId,
    pricingSnapshotId: input.order.pricing_snapshot_id,
    pricingEngineVersion: input.snapshot?.engine_version ?? null,
    companySettingsVersion: input.snapshot?.company_settings_version ?? null,
    amountCents: input.order.amount_cents,
    creditAppliedCents: input.order.credit_applied_cents,
    expectedChargeCents: preview.expectedChargeCents,
    stripeCustomerReady,
    stripePaymentMethodReady,
    billable: reasons.length === 0,
    blockingReasons: reasons,
    executionEnabled: false,
  };
}

function byId<T extends { id: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((row) => [row.id, row]));
}

async function selectByIds<T>(table: string, select: string, ids: string[]): Promise<T[]> {
  if (ids.length === 0) return [];
  const supabase = createPrivilegedServerSupabaseClient();
  const result = await supabase.from(table).select(select).in("id", ids);
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []) as T[];
}

export async function loadMonthlyBillingPreview(serviceMonthInput: string): Promise<{
  serviceMonth: string;
  executionEnabled: false;
  orders: MonthlyPreviewRow[];
}> {
  const serviceMonth = normalizeServiceMonth(serviceMonthInput);
  if (!serviceMonth) throw new Error("Service month must use YYYY-MM or YYYY-MM-01.");

  const supabase = createPrivilegedServerSupabaseClient();
  const orderResult = await supabase
    .from("billing_orders")
    .select("id, membership_id, property_id, obligation_id, appointment_id, pricing_snapshot_id, service_month, scheduled_service_at, amount_cents, credit_applied_cents, stripe_customer_ready, stripe_payment_method_ready")
    .eq("service_month", serviceMonth)
    .neq("preview_state", "void")
    .order("scheduled_service_at", { ascending: true });
  if (orderResult.error) throw new Error(orderResult.error.message);
  const orders = (orderResult.data ?? []) as OrderRow[];

  const [appointments, snapshots, memberships, obligations] = await Promise.all([
    selectByIds<AppointmentRow>("member_appointments", "id, property_id, matched_obligation_id, scheduled_at, provider, external_id, provenance_state, verification_state, match_state", orders.map((row) => row.appointment_id)),
    selectByIds<SnapshotRow>("atlas_pricing_snapshots", "id, engine_version, company_settings_version, authorized_charge_cents, override_amount_cents, membership_id, obligation_id, property_id", orders.map((row) => row.pricing_snapshot_id)),
    selectByIds<MembershipRow>("memberships", "id, property_id, homeowner_id, stripe_customer_id, stripe_payment_method_id", orders.map((row) => row.membership_id)),
    selectByIds<ObligationRow>("obligations", "id, membership_id, property_id", orders.map((row) => row.obligation_id)),
  ]);
  const appointmentMap = byId(appointments);
  const snapshotMap = byId(snapshots);
  const membershipMap = byId(memberships);
  const obligationMap = byId(obligations);
  const [properties, homeowners] = await Promise.all([
    selectByIds<PropertyRow>("properties", "id, address", orders.map((row) => row.property_id)),
    selectByIds<HomeownerRow>("homeowners", "id, full_name", memberships.map((row) => row.homeowner_id)),
  ]);
  const propertyMap = byId(properties);
  const homeownerMap = byId(homeowners);

  return {
    serviceMonth,
    executionEnabled: false,
    orders: orders.map((order) => {
      const appointment = appointmentMap.get(order.appointment_id);
      const membership = membershipMap.get(order.membership_id);
      return projectMonthlyPreviewRow({
        order,
        appointment,
        snapshot: snapshotMap.get(order.pricing_snapshot_id),
        membership,
        obligation: obligationMap.get(order.obligation_id),
        property: propertyMap.get(order.property_id),
        homeowner: membership ? homeownerMap.get(membership.homeowner_id) : undefined,
      });
    }),
  };
}
