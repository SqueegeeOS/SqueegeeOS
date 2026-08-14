"use client";

import { useState } from "react";
import { GlassCard } from "@/components/craft/glass-card";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import { formatCurrency } from "@/lib/admin/sales-calculations";
import { craftEyebrow } from "@/lib/craft/tokens";

export interface BillingAutomationControl {
  settings: {
    enabled: boolean;
    executionMode: "shadow" | "approval" | "automatic";
    maxChargeCents: number;
    lastRunAt: string | null;
    lastRunStatus: string | null;
    lastRunSummary: Record<string, unknown>;
  };
  nextAutomaticBillingDate: string;
  stripeLive: boolean;
  stripeWebhookConfigured: boolean;
  stripeWebhookVerified: boolean;
  stripeWebhookVerifiedAt: string | null;
  readyOrderCount: number;
  failedOrderCount: number;
  needsActionCount: number;
  reconciliationRequiredCount: number;
  paidOrderCount: number;
}

interface BillingRehearsal {
  runId: string;
  serviceMonth: string;
  appointments: number;
  eligible: number;
  eligibleAmountCents: number;
  created: number;
  alreadyPrepared: number;
  shadowed: number;
  blocked: number;
  blockedReasons: Record<string, number>;
}

const BILLING_BLOCKER_LABELS: Record<string, string> = {
  active_membership_not_found: "No active HomeAtlas membership",
  billing_schedule_not_supported: "Billing schedule is not first-of-service-month",
  signed_agreement_required: "Signed agreement is missing",
  signed_agreement_not_complete: "Signed agreement is incomplete",
  signed_agreement_binding_mismatch: "Agreement does not match this member and property",
  automatic_billing_authorization_unverified:
    "Signed automatic-billing terms need founder verification",
  signed_visit_price_mismatch: "Current member price differs from signed authorization",
  payment_setup_incomplete: "Payment setup is incomplete",
  stripe_customer_missing: "Stripe customer is missing",
  stripe_payment_method_missing: "Saved payment method is missing",
  membership_automatic_billing_paused: "Automatic billing is paused for this member",
  jobber_projection_missing: "Jobber visit details are missing",
  jobber_property_not_paired: "Jobber property is not paired",
  jobber_automatic_payment_enabled: "Jobber is already set to collect payment",
  jobber_invoice_state_unknown: "Jobber invoice state is unknown",
  jobber_invoice_visibility_unavailable: "Jobber invoice visibility is unavailable",
  jobber_visit_already_invoiced: "Jobber already created an invoice",
  jobber_job_price_missing: "Jobber job price is missing",
  jobber_billing_strategy_unsupported: "Jobber billing setup is unsupported",
  one_off_job_waiting_for_last_visit: "One-time job is waiting for its final visit",
  fixed_price_job_already_represented_this_month:
    "That fixed-price Jobber job is already represented this month",
  charge_above_founder_cap: "Charge exceeds the founder safety cap",
  paid_or_processing_jobber_charge_changed:
    "A paid or processing Jobber charge changed and needs review",
};

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nonNegativeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}

function parseBillingRehearsal(value: unknown): BillingRehearsal | null {
  const run = recordValue(value);
  const prepared = recordValue(run?.prepared);
  if (
    !run ||
    !prepared ||
    run.triggerSource !== "founder_manual" ||
    run.executionMode !== "shadow" ||
    typeof run.runId !== "string" ||
    typeof run.serviceMonth !== "string"
  ) {
    return null;
  }

  const rawReasons = recordValue(prepared.blockedReasons) ?? {};
  const blockedReasons = Object.fromEntries(
    Object.entries(rawReasons)
      .filter((entry): entry is [string, number] =>
        typeof entry[1] === "number" && entry[1] > 0,
      )
      .map(([reason, count]) => [reason, count]),
  );

  return {
    runId: run.runId,
    serviceMonth: run.serviceMonth,
    appointments: nonNegativeNumber(prepared.appointments),
    eligible: nonNegativeNumber(prepared.eligible),
    eligibleAmountCents: nonNegativeNumber(prepared.eligibleAmountCents),
    created: nonNegativeNumber(prepared.created),
    alreadyPrepared: nonNegativeNumber(prepared.alreadyPrepared),
    shadowed: nonNegativeNumber(prepared.shadowed),
    blocked: nonNegativeNumber(prepared.blocked),
    blockedReasons,
  };
}

function billingBlockerLabel(reason: string): string {
  return reason
    .split(",")
    .map(
      (part) =>
        BILLING_BLOCKER_LABELS[part] ??
        part.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()),
    )
    .join(" + ");
}

function readableDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function BillingAutomationPanel({
  control,
  onUpdated,
}: {
  control: BillingAutomationControl;
  onUpdated: () => Promise<void> | void;
}) {
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeIsError, setNoticeIsError] = useState(false);
  const [rehearsal, setRehearsal] = useState<BillingRehearsal | null>(() =>
    parseBillingRehearsal(control.settings.lastRunSummary),
  );
  const armed =
    control.settings.enabled && control.settings.executionMode === "automatic";
  const readyToArm =
    control.stripeLive &&
    control.stripeWebhookConfigured &&
    control.stripeWebhookVerified;

  const updateEnabled = async (enabled: boolean) => {
    if (
      enabled &&
      !window.confirm(
        "Arm automatic member billing? Atlas will charge only on the first day of a service month, after a verified Jobber visit, signed-price match, saved-card check, and duplicate-payment check all pass.",
      )
    ) {
      return;
    }
    setSaving(true);
    setNotice(null);
    setNoticeIsError(false);
    try {
      const response = await fetch("/api/admin/billing-automation", {
        method: "PATCH",
        headers: {
          ...getAdminRequestHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          enabled,
          executionMode: "automatic",
          maxChargeCents: control.settings.maxChargeCents,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) throw new Error(body?.error ?? "Update failed");
      setNotice(
        enabled
          ? "Automatic billing is armed for future first-of-month runs."
          : "Automatic billing is off. No unattended charges will run.",
      );
      await onUpdated();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Update failed");
      setNoticeIsError(true);
    } finally {
      setSaving(false);
    }
  };

  const scanNow = async () => {
    setSaving(true);
    setNotice(null);
    setNoticeIsError(false);
    try {
      const response = await fetch("/api/admin/billing-automation", {
        method: "POST",
        headers: {
          ...getAdminRequestHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "preview" }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        run?: unknown;
      } | null;
      if (!response.ok) throw new Error(body?.error ?? "Billing scan failed");
      const completedRehearsal = parseBillingRehearsal(body?.run);
      if (!completedRehearsal) {
        throw new Error("Billing rehearsal returned an incomplete report.");
      }
      setRehearsal(completedRehearsal);
      setNotice(
        `${completedRehearsal.eligible} eligible for ${formatCurrency(completedRehearsal.eligibleAmountCents / 100)}. This rehearsal did not create or confirm a Stripe charge.`,
      );
      await onUpdated();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Billing scan failed");
      setNoticeIsError(true);
    } finally {
      setSaving(false);
    }
  };

  const verifyLiveWebhook = async () => {
    setSaving(true);
    setNotice(null);
    setNoticeIsError(false);
    try {
      const response = await fetch("/api/admin/billing-automation", {
        method: "POST",
        headers: {
          ...getAdminRequestHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "verify_webhook" }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Live webhook verification failed");
      }
      setNotice(
        body?.message ??
          "No-charge live verification sent. Atlas is checking the signed webhook now.",
      );
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
      await onUpdated();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Live webhook verification failed",
      );
      setNoticeIsError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <GlassCard tone="subtle" padding="lg" motion="rise">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className={craftEyebrow}>First-of-service-month automation</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h2 className="font-serif text-2xl font-light text-foreground">
              Automatic member billing
            </h2>
            <span
              className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.16em] ${
                armed
                  ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-200"
                  : "border-amber-300/30 bg-amber-300/[0.08] text-amber-100"
              }`}
            >
              {armed
                ? "Armed"
                : control.settings.enabled
                  ? "Needs review"
                  : "Off"}
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Atlas charges an eligible service from the member&apos;s paired Jobber
            property on the first of its service month only when Jobber supplies
            a supported price, the member has signed the current authorization,
            a saved card exists, and Jobber is not already invoicing or
            auto-charging it. Deployment never turns this on by itself.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving || (!control.settings.enabled && !readyToArm)}
            onClick={() => void updateEnabled(!control.settings.enabled)}
            className="rounded-full bg-accent px-5 py-2.5 text-xs font-medium uppercase tracking-[0.14em] text-background transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {saving
              ? "Working..."
              : control.settings.enabled
                ? "Turn off"
                : "Arm automation"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void scanNow()}
            className="rounded-full border border-border/60 px-5 py-2.5 text-xs uppercase tracking-[0.14em] text-muted transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45"
          >
            Run billing rehearsal (no charge)
          </button>
          {!control.stripeWebhookVerified ? (
            <button
              type="button"
              disabled={
                saving ||
                !control.stripeLive ||
                !control.stripeWebhookConfigured
              }
              onClick={() => void verifyLiveWebhook()}
              className="rounded-full border border-border/60 px-5 py-2.5 text-xs uppercase tracking-[0.14em] text-muted transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45"
            >
              Verify live webhook (no charge)
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Live Stripe", control.stripeLive ? "Ready" : "Needs live keys"],
          [
            "Stripe webhook",
            !control.stripeWebhookConfigured
              ? "Needs setup"
              : control.stripeWebhookVerified
                ? "Live delivery verified"
                : "Needs no-charge live verification",
          ],
          ["Next automatic run", readableDate(control.nextAutomaticBillingDate)],
          [
            "Founder safety cap",
            formatCurrency(control.settings.maxChargeCents / 100),
          ],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-border/60 bg-background/35 p-4"
          >
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted">
              {label}
            </p>
            <p className="mt-2 text-sm text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {rehearsal ? (
        <section className="mt-6 rounded-3xl border border-emerald-400/20 bg-emerald-400/[0.045] p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <p className={craftEyebrow}>No-charge rehearsal</p>
              <h3 className="mt-2 font-serif text-xl font-light text-foreground">
                {readableDate(rehearsal.serviceMonth)} billing window
              </h3>
              <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted">
                Atlas ran the real eligibility rules in shadow mode. It may save
                review records, but it cannot claim an order or contact Stripe.
              </p>
            </div>
            <span className="self-start rounded-full border border-emerald-400/30 bg-emerald-400/[0.08] px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-emerald-200">
              Stripe not contacted
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Jobber visits scanned", String(rehearsal.appointments)],
              ["Eligible services", String(rehearsal.eligible)],
              [
                "Expected collection",
                formatCurrency(rehearsal.eligibleAmountCents / 100),
              ],
              ["Blocked for review", String(rehearsal.blocked)],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-border/50 bg-background/35 p-4"
              >
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted">
                  {label}
                </p>
                <p className="mt-2 font-serif text-xl font-light text-foreground">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs leading-relaxed text-muted">
            {rehearsal.created} new preview order
            {rehearsal.created === 1 ? "" : "s"} · {rehearsal.alreadyPrepared}{" "}
            already prepared · {rehearsal.shadowed} kept in no-charge shadow
          </p>

          {Object.keys(rehearsal.blockedReasons).length > 0 ? (
            <div className="mt-4 border-t border-border/50 pt-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted">
                What needs fixing
              </p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {Object.entries(rehearsal.blockedReasons)
                  .sort((left, right) => right[1] - left[1])
                  .map(([reason, count]) => (
                    <li
                      key={reason}
                      className="flex items-start justify-between gap-3 rounded-xl border border-border/45 bg-background/30 px-3 py-2.5 text-xs text-muted"
                    >
                      <span>{billingBlockerLabel(reason)}</span>
                      <span className="shrink-0 tabular-nums text-foreground">
                        {count}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
        <span>{control.readyOrderCount} ready</span>
        <span>{control.needsActionCount} need card action</span>
        <span>{control.reconciliationRequiredCount} need reconciliation</span>
        <span>{control.failedOrderCount} failed</span>
        <span>{control.paidOrderCount} paid through automation</span>
        {control.settings.lastRunAt ? (
          <span>
            Last run {new Date(control.settings.lastRunAt).toLocaleString()} ·{" "}
            {control.settings.lastRunStatus ?? "unknown"}
          </span>
        ) : null}
      </div>

      <p className="mt-4 rounded-2xl border border-border/60 bg-background/35 px-4 py-3 text-xs leading-relaxed text-muted">
        A first-ever service-month charge discovered after the 1st stays in
        no-charge preview for founder review; Atlas does not silently catch it
        up later in the month. A retry is different: it targets one exact,
        already-locked failed order after you explicitly confirm it.
      </p>

      {!readyToArm && !control.settings.enabled ? (
        <p className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3 text-xs leading-relaxed text-amber-100">
          Finish the missing Stripe readiness item above before Atlas can be
          armed. Until then this remains a no-charge preview.
        </p>
      ) : null}
      {control.settings.enabled && !armed ? (
        <p className="mt-4 rounded-2xl border border-red-300/25 bg-red-300/[0.06] px-4 py-3 text-xs leading-relaxed text-red-100">
          The database says billing is enabled, but automatic execution mode is
          not active. Treat automation as unavailable and turn it off before
          reviewing the setup.
        </p>
      ) : null}
      {notice ? (
        <p
          className={`mt-4 text-xs leading-relaxed ${noticeIsError ? "text-red-300" : "text-muted"}`}
          role={noticeIsError ? "alert" : "status"}
        >
          {notice}
        </p>
      ) : null}
    </GlassCard>
  );
}
