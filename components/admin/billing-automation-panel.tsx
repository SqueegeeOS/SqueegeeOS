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
      } | null;
      if (!response.ok) throw new Error(body?.error ?? "Billing scan failed");
      setNotice(
        "Eligibility preview refreshed. This action did not create or confirm a Stripe charge.",
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
            Atlas charges the signed visit price only when the current month has
            a verified visit from the explicitly classified Jobber membership
            job, a unique service obligation, a saved card, and no prior
            payment. Deployment never turns this on by itself.
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
            Preview eligibility (no charge)
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
