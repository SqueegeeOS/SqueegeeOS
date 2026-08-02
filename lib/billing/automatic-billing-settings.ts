import "server-only";

import { createHash } from "node:crypto";
import { formatBusinessCalendarDate } from "@/lib/admin/company-business-timezone";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { AUTOMATIC_BILLING_SETTINGS_ID } from "./automatic-billing-rules";

export type AutomaticBillingExecutionMode =
  | "shadow"
  | "approval"
  | "automatic";

export interface AutomaticBillingSettings {
  enabled: boolean;
  enabledAt: string | null;
  enabledBy: string | null;
  executionMode: AutomaticBillingExecutionMode;
  maxChargeCents: number;
  stripeWebhookVerifiedAt: string | null;
  stripeWebhookSecretFingerprint: string | null;
  lastRunAt: string | null;
  lastRunStatus: "disabled" | "succeeded" | "partial" | "failed" | null;
  lastRunSummary: Record<string, unknown>;
  updatedAt: string;
}

export function currentStripeWebhookSecretFingerprint(): string | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  return secret ? createHash("sha256").update(secret).digest("hex") : null;
}

export function isCurrentStripeWebhookVerified(
  settings: Pick<
    AutomaticBillingSettings,
    "stripeWebhookVerifiedAt" | "stripeWebhookSecretFingerprint"
  >,
): boolean {
  const currentFingerprint = currentStripeWebhookSecretFingerprint();
  return Boolean(
    currentFingerprint &&
      settings.stripeWebhookVerifiedAt &&
      settings.stripeWebhookSecretFingerprint === currentFingerprint,
  );
}

interface SettingsRow {
  enabled: boolean;
  enabled_at: string | null;
  enabled_by: string | null;
  execution_mode: AutomaticBillingExecutionMode;
  max_charge_cents: number;
  stripe_webhook_verified_at: string | null;
  stripe_webhook_secret_fingerprint: string | null;
  last_run_at: string | null;
  last_run_status: AutomaticBillingSettings["lastRunStatus"];
  last_run_summary: Record<string, unknown> | null;
  updated_at: string;
}

function mapSettings(row: SettingsRow): AutomaticBillingSettings {
  return {
    enabled: row.enabled,
    enabledAt: row.enabled_at,
    enabledBy: row.enabled_by,
    executionMode: row.execution_mode,
    maxChargeCents: row.max_charge_cents,
    stripeWebhookVerifiedAt: row.stripe_webhook_verified_at,
    stripeWebhookSecretFingerprint:
      row.stripe_webhook_secret_fingerprint,
    lastRunAt: row.last_run_at,
    lastRunStatus: row.last_run_status,
    lastRunSummary: row.last_run_summary ?? {},
    updatedAt: row.updated_at,
  };
}

export async function loadAutomaticBillingSettings(): Promise<AutomaticBillingSettings> {
  const supabase = createServiceRoleSupabaseClient();
  const result = await supabase
    .from("billing_automation_settings")
    .select(
      "enabled, enabled_at, enabled_by, execution_mode, max_charge_cents, stripe_webhook_verified_at, stripe_webhook_secret_fingerprint, last_run_at, last_run_status, last_run_summary, updated_at",
    )
    .eq("id", AUTOMATIC_BILLING_SETTINGS_ID)
    .single();
  if (result.error) throw new Error(result.error.message);
  return mapSettings(result.data as SettingsRow);
}

export async function updateAutomaticBillingSettings(input: {
  enabled: boolean;
  actor: string;
  executionMode?: AutomaticBillingExecutionMode;
  maxChargeCents?: number;
}): Promise<AutomaticBillingSettings> {
  const actor = input.actor.trim();
  if (!actor) throw new Error("Billing automation actor is required.");
  const maxChargeCents = input.maxChargeCents;
  if (
    maxChargeCents !== undefined &&
    (!Number.isInteger(maxChargeCents) ||
      maxChargeCents <= 0 ||
      maxChargeCents > 1_000_000)
  ) {
    throw new Error("Automatic charge cap must be between $0.01 and $10,000.");
  }

  const now = new Date().toISOString();
  const patch = {
    enabled: input.enabled,
    enabled_at: input.enabled ? now : null,
    enabled_by: input.enabled ? actor : null,
    ...(input.executionMode ? { execution_mode: input.executionMode } : {}),
    ...(maxChargeCents !== undefined
      ? { max_charge_cents: maxChargeCents }
      : {}),
  };
  const supabase = createServiceRoleSupabaseClient();
  const result = await supabase
    .from("billing_automation_settings")
    .update(patch)
    .eq("id", AUTOMATIC_BILLING_SETTINGS_ID)
    .select(
      "enabled, enabled_at, enabled_by, execution_mode, max_charge_cents, stripe_webhook_verified_at, stripe_webhook_secret_fingerprint, last_run_at, last_run_status, last_run_summary, updated_at",
    )
    .single();
  if (result.error) throw new Error(result.error.message);
  if (!input.enabled) {
    // Orders that have touched Stripe must never be voided like untouched
    // queue work. Stop their retry path or quarantine an in-flight attempt; a
    // late signed Stripe success can still atomically promote either to paid.
    const providerContacted = await supabase
      .from("billing_orders")
      .select("id, attempt_count, stripe_payment_intent_id, execution_state")
      .eq("preview_state", "locked")
      .in("execution_state", ["processing", "failed_retryable", "pending"]);
    if (providerContacted.error) {
      throw new Error(providerContacted.error.message);
    }
    for (const order of providerContacted.data ?? []) {
      const inFlight =
        order.execution_state === "processing" ||
        (order.execution_state === "pending" &&
          Boolean(order.stripe_payment_intent_id));
      if (order.execution_state === "pending" && !inFlight) continue;
      const quarantined = await supabase.rpc(
        "finalize_billing_attempt_failure",
        {
          p_order_id: order.id,
          p_attempt_number: order.attempt_count,
          p_outcome: inFlight
            ? "reconciliation_required"
            : "permanently_failed",
          p_intent_id: order.stripe_payment_intent_id,
          p_next_attempt_at: null,
          p_failure_code: inFlight
            ? "global_billing_disabled_during_processing"
            : "global_billing_disabled",
          p_failure_message: inFlight
            ? "Headquarters turned automatic billing off while this Stripe attempt was in flight."
            : "Headquarters turned automatic billing off before the scheduled retry.",
          p_completed_at: now,
        },
      );
      if (quarantined.error) throw new Error(quarantined.error.message);
    }
    const queued = await supabase
      .from("billing_orders")
      .select("id")
      .eq("preview_state", "locked")
      .eq("execution_state", "pending")
      .is("stripe_payment_intent_id", null);
    if (queued.error) throw new Error(queued.error.message);
    for (const order of queued.data ?? []) {
      const voided = await supabase
        .from("billing_orders")
        .update({
          preview_state: "void",
          execution_state: "void",
          locked_at: null,
          lease_owner: null,
          lease_expires_at: null,
          blocking_reasons: ["global_billing_disabled"],
          failure_code: "global_billing_disabled",
          failure_message: "Headquarters turned automatic billing off.",
        })
        .eq("id", order.id)
        .eq("execution_state", "pending")
        .is("stripe_payment_intent_id", null)
        .select("id")
        .maybeSingle();
      if (voided.error) throw new Error(voided.error.message);
      if (!voided.data) continue;
      const event = await supabase.from("billing_order_events").insert({
        billing_order_id: order.id,
        event_type: "voided",
        actor,
        reason: "Headquarters turned automatic billing off",
        event_data: {},
      });
      if (event.error) throw new Error(event.error.message);
    }
  }
  return mapSettings(result.data as SettingsRow);
}

export function isFirstBusinessDay(referenceDate = new Date()): boolean {
  return formatBusinessCalendarDate(referenceDate).endsWith("-01");
}

export function nextAutomaticBillingDate(referenceDate = new Date()): string {
  const businessDate = formatBusinessCalendarDate(referenceDate);
  if (businessDate.endsWith("-01")) return businessDate;
  const [year, month] = businessDate.split("-").map(Number);
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
}

export async function recordAutomaticBillingRunOnSettings(input: {
  status: NonNullable<AutomaticBillingSettings["lastRunStatus"]>;
  summary: Record<string, unknown>;
  completedAt?: string;
}): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const result = await supabase
    .from("billing_automation_settings")
    .update({
      last_run_at: input.completedAt ?? new Date().toISOString(),
      last_run_status: input.status,
      last_run_summary: input.summary,
    })
    .eq("id", AUTOMATIC_BILLING_SETTINGS_ID);
  if (result.error) throw new Error(result.error.message);
}
