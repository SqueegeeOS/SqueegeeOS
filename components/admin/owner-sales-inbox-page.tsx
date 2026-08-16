"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { HqFounderNav } from "@/components/admin/hq-founder-nav";
import { PaymentSetupEmailButton } from "@/components/admin/payment-setup-email-button";
import { SalesPhoneAccessPanel } from "@/components/admin/sales-phone-access-panel";
import { AmbientStage } from "@/components/craft/ambient-stage";
import { GlassCard } from "@/components/craft/glass-card";
import { MotionReveal } from "@/components/craft/motion-reveal";
import { LeadInteractionControl } from "@/components/sales/lead-interaction-control";
import {
  ServiceInterestChips,
  ServiceInterestPicker,
} from "@/components/sales/service-interest-control";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import { useAdminUnlockedState } from "@/lib/admin/use-admin-unlocked-state";
import { paymentHandoffSendLabel } from "@/lib/membership/payment-handoff-progress";
import { usePaymentHandoffRefresh } from "@/lib/membership/use-payment-handoff-refresh";
import type {
  OwnerSalesPipelineHandoff,
  OwnerSalesPipelineLead,
  OwnerSalesPipelineSnapshot,
} from "@/lib/sales/owner-pipeline";
import type { SalesLeadActionMoment } from "@/lib/sales/lead-action-priority";
import type { SalesProductionHandoffStage } from "@/lib/sales/production-handoff";
import type { EnrollmentPacketProgressTone } from "@/lib/enrollment/packet-progress";
import type {
  RecordSalesLeadInteractionInput,
  SalesLeadStatus,
} from "@/lib/sales/workspace-types";

const ACTION_STYLE: Record<
  SalesLeadActionMoment,
  { label: string; className: string }
> = {
  overdue: {
    label: "Overdue",
    className: "border-red-400/25 bg-red-400/[0.08] text-red-200",
  },
  due_today: {
    label: "Due today",
    className: "border-amber-300/25 bg-amber-300/[0.08] text-amber-100",
  },
  unscheduled: {
    label: "Needs next move",
    className: "border-sky-300/20 bg-sky-300/[0.07] text-sky-100",
  },
  upcoming: {
    label: "Scheduled",
    className: "border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-100",
  },
};

const HANDOFF_STYLE: Record<
  SalesProductionHandoffStage,
  { className: string; progressClassName: string }
> = {
  payment_needed: {
    className: "border-red-300/20 bg-red-300/[0.055] text-red-100",
    progressClassName: "bg-red-200",
  },
  payment_pending: {
    className: "border-violet-300/20 bg-violet-300/[0.055] text-violet-100",
    progressClassName: "bg-violet-200",
  },
  membership_attention: {
    className: "border-amber-300/22 bg-amber-300/[0.06] text-amber-100",
    progressClassName: "bg-amber-200",
  },
  property_pairing_needed: {
    className: "border-sky-300/20 bg-sky-300/[0.055] text-sky-100",
    progressClassName: "bg-sky-200",
  },
  job_pairing_needed: {
    className: "border-sky-300/20 bg-sky-300/[0.055] text-sky-100",
    progressClassName: "bg-sky-200",
  },
  source_unavailable: {
    className: "border-violet-300/20 bg-violet-300/[0.055] text-violet-100",
    progressClassName: "bg-violet-200",
  },
  schedule_needed: {
    className: "border-cyan-300/20 bg-cyan-300/[0.055] text-cyan-100",
    progressClassName: "bg-cyan-200",
  },
  ready: {
    className: "border-emerald-300/22 bg-emerald-300/[0.06] text-emerald-100",
    progressClassName: "bg-emerald-200",
  },
};

const CLOSE_JOURNEY_STYLE: Record<EnrollmentPacketProgressTone, string> = {
  neutral: "border-white/10 bg-white/[0.035] text-white/68",
  accent: "border-accent/25 bg-accent/[0.07] text-accent",
  warning: "border-amber-300/25 bg-amber-300/[0.07] text-amber-100",
  success: "border-emerald-300/22 bg-emerald-300/[0.065] text-emerald-100",
};

type EditableLeadStatus = Extract<
  SalesLeadStatus,
  "new" | "follow_up" | "presentation" | "considering" | "lost"
>;

const STATUS_OPTIONS: Array<{ value: EditableLeadStatus; label: string }> = [
  { value: "new", label: "New lead" },
  { value: "follow_up", label: "Follow up" },
  { value: "presentation", label: "Presentation" },
  { value: "considering", label: "Customer considering" },
  { value: "lost", label: "Closed / lost" },
];

const MOMENT_FILTERS: Array<{
  value: "all" | SalesLeadActionMoment;
  label: string;
}> = [
  { value: "all", label: "All open" },
  { value: "overdue", label: "Overdue" },
  { value: "due_today", label: "Today" },
  { value: "unscheduled", label: "Needs next move" },
  { value: "upcoming", label: "Upcoming" },
];

function money(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function dateTimeLabel(value: string | null): string {
  if (!value) return "No next action scheduled";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Invalid next action";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function conciseDateLabel(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: parsed.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(parsed);
}

function localDateTimeInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function defaultFollowUpInput(daysAhead = 1): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  date.setHours(9, 0, 0, 0);
  return localDateTimeInput(date.toISOString());
}

function contactState(label: string, value: string | null, consent: string) {
  if (!value) return `${label} missing`;
  if (consent === "opted_in") return `${label} consented`;
  if (consent === "opted_out") return `${label} opted out`;
  return `${label} not consented`;
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <GlassCard tone="subtle" padding="sm">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/42">
        {label}
      </p>
      <p className="mt-2 font-serif text-3xl font-light tabular-nums text-[#f5f2eb]">
        {value}
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-white/36">{hint}</p>
    </GlassCard>
  );
}

function LeadActionCard({
  lead,
  onSaved,
}: {
  lead: OwnerSalesPipelineLead;
  onSaved: (message: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<EditableLeadStatus>(
    lead.status as EditableLeadStatus,
  );
  const [estimatedArrDollars, setEstimatedArrDollars] = useState(
    String(lead.estimatedArrCents / 100),
  );
  const [serviceInterests, setServiceInterests] = useState(
    lead.serviceInterests,
  );
  const [nextFollowUpAt, setNextFollowUpAt] = useState(
    localDateTimeInput(lead.nextFollowUpAt),
  );
  const [notes, setNotes] = useState(lead.notes);
  const action = ACTION_STYLE[lead.actionMoment];
  const presentationActionLabel =
    lead.presentationState === "needs_attention"
      ? "Review presentations"
      : (lead.closeJourney?.actionLabel ??
        (lead.presentationState === "none"
          ? "Build presentation"
          : lead.presentationStatus === "signed"
            ? "View signed plan"
            : "Resume presentation"));

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/sales/pipeline", {
        method: "PATCH",
        headers: getAdminRequestHeaders(),
        body: JSON.stringify({
          repSlug: lead.repSlug,
          lead: {
            leadId: lead.id,
            status,
            estimatedArrDollars: Number(estimatedArrDollars),
            serviceInterests,
            nextFollowUpAt: nextFollowUpAt
              ? new Date(nextFollowUpAt).toISOString()
              : null,
            notes,
          },
        }),
      });
      const body = (await response.json().catch(() => null)) as
        | { message?: string; error?: string }
        | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Owner next move could not be saved.");
      }
      setEditing(false);
      await onSaved(body?.message ?? "Owner next move saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Owner next move could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function recordInteraction(input: RecordSalesLeadInteractionInput) {
    const response = await fetch("/api/admin/sales/pipeline", {
      method: "POST",
      headers: getAdminRequestHeaders(),
      body: JSON.stringify({
        repSlug: lead.repSlug,
        interaction: input,
      }),
    });
    const body = (await response.json().catch(() => null)) as
      | { message?: string; error?: string }
      | null;
    if (!response.ok) {
      throw new Error(body?.error ?? "The follow-up outcome could not be recorded.");
    }
    const message =
      body?.message ?? "Outcome recorded. No message, appointment, or charge was sent.";
    void onSaved(message);
    return message;
  }

  return (
    <article
      id={`owner-sales-lead-${lead.id}`}
      className="scroll-mt-28 rounded-[1.6rem] border border-white/[0.085] bg-[linear-gradient(145deg,rgba(20,18,14,0.86),rgba(8,8,8,0.94))] p-5 shadow-[0_18px_55px_rgba(0,0,0,0.24)] sm:p-6"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${action.className}`}
            >
              {action.label}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-white/48">
              {lead.repDisplayName}
            </span>
            {lead.repPlan === "founding_david" ? (
              <span className="rounded-full border border-accent/20 bg-accent/[0.07] px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-accent/85">
                Founding track
              </span>
            ) : null}
          </div>
          <h2 className="mt-4 truncate font-serif text-2xl font-light text-[#f5f2eb] sm:text-3xl">
            {lead.fullName}
          </h2>
          <p className="mt-1 text-sm text-white/48">{lead.propertyAddress}</p>
          <ServiceInterestChips
            interests={lead.serviceInterests}
            className="mt-3"
          />
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/42">
            <span>{money(lead.estimatedArrCents)} potential ARR</span>
            <span>{dateTimeLabel(lead.nextFollowUpAt)}</span>
            <span>{lead.status.replaceAll("_", " ")}</span>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href={lead.presentationHref}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-accent/25 bg-accent px-4 text-xs font-semibold text-background transition hover:brightness-105 active:scale-[0.98]"
          >
            {presentationActionLabel}
          </Link>
          <button
            type="button"
            onClick={() => setEditing((current) => !current)}
            className="min-h-11 rounded-xl border border-white/12 bg-white/[0.045] px-4 text-xs font-medium text-white/78 transition hover:bg-white/[0.08] active:scale-[0.98]"
          >
            {editing ? "Close editor" : "Update next move"}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 border-t border-white/[0.07] pt-4 text-xs sm:grid-cols-3">
        <p className="rounded-xl bg-black/20 px-3 py-2.5 text-white/45">
          {contactState("Phone", lead.phone, lead.smsConsentStatus)}
        </p>
        <p className="rounded-xl bg-black/20 px-3 py-2.5 text-white/45">
          {contactState("Email", lead.email, lead.emailConsentStatus)}
        </p>
        <p
          className={`rounded-xl px-3 py-2.5 ${
            lead.presentationState === "needs_attention"
              ? "bg-red-400/[0.08] text-red-200"
              : "bg-black/20 text-white/45"
          }`}
        >
          {lead.presentationState === "none"
            ? "No presentation yet"
            : lead.presentationState === "needs_attention"
              ? `${lead.presentationCount} linked presentations need review`
              : `${lead.presentationStatus} presentation linked`}
        </p>
      </div>

      {lead.closeJourney ? (
        <div
          className={`mt-4 rounded-2xl border p-3.5 ${CLOSE_JOURNEY_STYLE[lead.closeJourney.tone]}`}
          role="status"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] opacity-80">
            Close journey · {lead.closeJourney.label}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-white/55">
            {lead.closeJourney.detail}
          </p>
        </div>
      ) : null}

      <LeadInteractionControl lead={lead} onRecord={recordInteraction} />

      {!editing && lead.notes ? (
        <p className="mt-4 rounded-xl border border-white/[0.06] bg-black/20 px-4 py-3 text-sm leading-relaxed text-white/52">
          {lead.notes}
        </p>
      ) : null}

      {editing ? (
        <div className="mt-5 rounded-2xl border border-accent/15 bg-accent/[0.035] p-4 sm:p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.16em] text-white/44">
                Stage
              </span>
              <select
                value={status}
                onChange={(event) => {
                  const next = event.target.value as EditableLeadStatus;
                  setStatus(next);
                  if (
                    ["follow_up", "considering"].includes(next) &&
                    !nextFollowUpAt
                  ) {
                    setNextFollowUpAt(defaultFollowUpInput());
                  }
                }}
                className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-[#11100e] px-3 text-sm text-white outline-none focus:border-accent/45"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.16em] text-white/44">
                Estimated annual value
              </span>
              <input
                type="number"
                min="0"
                max="1000000"
                step="25"
                inputMode="decimal"
                value={estimatedArrDollars}
                onChange={(event) => setEstimatedArrDollars(event.target.value)}
                className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-[#11100e] px-3 text-sm text-white outline-none focus:border-accent/45"
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.16em] text-white/44">
                Next action
              </span>
              <input
                type="datetime-local"
                value={nextFollowUpAt}
                onChange={(event) => setNextFollowUpAt(event.target.value)}
                className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-[#11100e] px-3 text-sm text-white outline-none focus:border-accent/45"
              />
            </label>
          </div>

          <ServiceInterestPicker
            idPrefix={`owner-lead-services-${lead.id}`}
            value={serviceInterests}
            className="mt-4"
            onChange={setServiceInterests}
          />
          <label className="mt-4 block">
            <span className="text-[10px] uppercase tracking-[0.16em] text-white/44">
              Latest context {status === "lost" ? "· reason required" : ""}
            </span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="What matters before the next conversation?"
              className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-[#11100e] px-3 py-3 text-sm leading-relaxed text-white outline-none focus:border-accent/45"
            />
          </label>
          {error ? (
            <p role="alert" className="mt-3 text-sm text-red-300">
              {error}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-white/38">
              Saving does not text, email, enroll, or charge this customer.
            </p>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="min-h-11 rounded-xl bg-accent px-5 text-xs font-semibold text-background transition hover:brightness-105 active:scale-[0.98] disabled:cursor-wait disabled:opacity-55"
            >
              {saving ? "Saving…" : "Save next move"}
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function SignedHandoffCard({
  handoff,
  onAccepted,
}: {
  handoff: OwnerSalesPipelineHandoff;
  onAccepted: (message: string) => void;
}) {
  const style = HANDOFF_STYLE[handoff.stage];
  const progress = (handoff.completedSteps / handoff.totalSteps) * 100;
  const canEmailPaymentSetup =
    handoff.stage === "payment_needed" &&
    handoff.paymentSetupEmailState === "ready" &&
    handoff.paymentHandoffProgress.canSend &&
    Boolean(handoff.membershipId);

  return (
    <article
      id={`owner-sales-handoff-${handoff.attributionId}`}
      className={`scroll-mt-28 overflow-hidden rounded-[1.5rem] border p-4 sm:p-5 ${style.className}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-current/20 bg-black/15 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.13em]">
              {handoff.repDisplayName}
            </span>
            <span className="text-[9px] uppercase tracking-[0.13em] opacity-55">
              Signed {conciseDateLabel(handoff.attributedAt)}
            </span>
          </div>
          <h3 className="mt-3 truncate font-serif text-2xl text-[#f5f2eb]">
            {handoff.homeownerName}
          </h3>
          <p className="mt-1 truncate text-xs opacity-58">
            {handoff.propertyAddress}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-serif text-2xl tabular-nums text-[#f5f2eb]">
            {handoff.completedSteps}/{handoff.totalSteps}
          </p>
          <p className="mt-1 text-[9px] uppercase tracking-[0.12em] opacity-48">
            {money(handoff.attributedArrCents)} ARR
          </p>
        </div>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-black/25" aria-hidden="true">
        <div
          className={`h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${style.progressClassName}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="mt-4 text-sm font-semibold text-current">{handoff.label}</p>
      <p className="mt-1 text-xs leading-5 opacity-72">{handoff.detail}</p>
      {handoff.paymentHandoffProgress.state === "email_sent" ? (
        <div className="mt-3 rounded-xl border border-current/15 bg-black/15 px-3 py-2 text-[10px] leading-4 opacity-78">
          <p className="font-bold uppercase tracking-[0.11em]">
            Secure email accepted
          </p>
          <p className="mt-1">
            {handoff.paymentHandoffProgress.emailSentAt
              ? `Sent ${dateTimeLabel(handoff.paymentHandoffProgress.emailSentAt)}. `
              : ""}
            {handoff.paymentHandoffProgress.expiresAt
              ? `Link active until ${dateTimeLabel(handoff.paymentHandoffProgress.expiresAt)}.`
              : "Waiting for Stripe confirmation."}
          </p>
        </div>
      ) : handoff.paymentHandoffProgress.state === "completed" ? (
        <p
          className="mt-3 rounded-xl border border-emerald-200/20 bg-emerald-200/[0.07] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.11em] text-emerald-100"
          role="status"
        >
          Stripe confirmed · card on file
        </p>
      ) : handoff.paymentHandoffProgress.state === "preparing" ? (
        <p className="mt-3 rounded-xl border border-current/15 bg-black/15 px-3 py-2 text-[10px] leading-4 opacity-78">
          Preparation is inside its five-minute safety window. Refresh before
          retrying so the customer receives one deliberate email.
        </p>
      ) : null}
      {handoff.nextScheduledAt && handoff.stage === "ready" ? (
        <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.12em]">
          Next visit · {dateTimeLabel(handoff.nextScheduledAt)}
        </p>
      ) : null}

      {canEmailPaymentSetup ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3.5">
          <PaymentSetupEmailButton
            membershipId={handoff.membershipId}
            canSend
            idleLabel={paymentHandoffSendLabel(
              handoff.paymentHandoffProgress.state,
            )}
            variant="primary"
            onAccepted={onAccepted}
          />
          <p className="mt-2 text-[10px] leading-4 text-white/48">
            Sends only when pressed. Stripe saves the card; no charge occurs in
            this setup step. Text remains locked until Twilio approval and explicit
            customer SMS consent are both verified.
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={handoff.actionHref}
          className="inline-flex min-h-11 items-center rounded-full border border-current/30 bg-black/15 px-4 text-[10px] font-bold uppercase tracking-[0.12em] transition hover:bg-black/25"
        >
          {handoff.actionLabel} →
        </Link>
        <Link
          href={`${handoff.repWorkspacePath}#verified-closes`}
          className="inline-flex min-h-11 items-center rounded-full border border-white/10 px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-white/52 transition hover:border-white/20 hover:text-white/78"
        >
          Open rep close
        </Link>
      </div>
    </article>
  );
}

function SignedHandoffDesk({
  snapshot,
  loading,
  onRefresh,
  onAccepted,
}: {
  snapshot: OwnerSalesPipelineSnapshot | null;
  loading: boolean;
  onRefresh: () => void;
  onAccepted: (message: string) => void;
}) {
  const handoffs = snapshot?.handoffs ?? null;
  const count = (value: number | null | undefined) =>
    loading ? "…" : value === null || value === undefined ? "—" : String(value);

  return (
    <section id="signed-to-scheduled" className="mt-10 scroll-mt-28">
      <div className="overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[radial-gradient(circle_at_92%_0%,rgba(110,231,183,0.09),transparent_34%),rgba(8,11,9,0.8)] p-5 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200/68">
              Signed → scheduled
            </p>
            <h2 className="mt-2 font-serif text-3xl font-light text-[#f5f2eb] sm:text-4xl">
              Every close stays owned until the first visit is real.
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/46">
              Agreement-backed closes move through card setup, membership health,
              Jobber property and recurring-job pairing, then a current scheduled
              visit. This desk reads proof. An accepted active card link moves to
              Waiting instead of creating duplicate owner work. Its labeled email
              control sends only when pressed and never charges.
            </p>
          </div>
          <div className="grid shrink-0 grid-cols-4 gap-2 lg:w-[30rem]">
            <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-3 text-center">
              <p className="font-serif text-2xl tabular-nums text-[#f5f2eb]">
                {count(handoffs?.summary.signedCount)}
              </p>
              <p className="mt-1 text-[8px] uppercase tracking-[0.12em] text-white/38">Signed</p>
            </div>
            <div className="rounded-2xl border border-amber-300/12 bg-amber-300/[0.035] p-3 text-center">
              <p className="font-serif text-2xl tabular-nums text-amber-100">
                {count(handoffs?.summary.actionCount)}
              </p>
              <p className="mt-1 text-[8px] uppercase tracking-[0.12em] text-amber-100/45">Needs owner</p>
            </div>
            <div className="rounded-2xl border border-violet-300/12 bg-violet-300/[0.035] p-3 text-center">
              <p className="font-serif text-2xl tabular-nums text-violet-100">
                {count(handoffs?.summary.waitingCount)}
              </p>
              <p className="mt-1 text-[8px] uppercase tracking-[0.12em] text-violet-100/45">Waiting</p>
            </div>
            <div className="rounded-2xl border border-emerald-300/12 bg-emerald-300/[0.035] p-3 text-center">
              <p className="font-serif text-2xl tabular-nums text-emerald-100">
                {count(handoffs?.summary.readyCount)}
              </p>
              <p className="mt-1 text-[8px] uppercase tracking-[0.12em] text-emerald-100/45">Ready</p>
            </div>
          </div>
        </div>

        {handoffs?.summary.waitingCount ? (
          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-violet-300/15 bg-violet-300/[0.04] px-4 py-3 text-violet-50 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-violet-100/65">
              Stripe status refreshes while this screen is open and whenever you
              return to it. Completion never triggers a charge.
            </p>
            <button
              type="button"
              onClick={onRefresh}
              className="min-h-10 shrink-0 rounded-full border border-violet-100/25 bg-black/15 px-4 text-[9px] font-bold uppercase tracking-[0.12em]"
            >
              Check Stripe now
            </button>
          </div>
        ) : null}

        {loading ? (
          <p className="py-12 text-center text-sm text-white/38">
            Verifying every agreement-backed close…
          </p>
        ) : handoffs?.status === "unavailable" ? (
          <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/[0.055] p-5 text-amber-50">
            <p className="text-sm font-semibold">Signed handoff truth is unavailable.</p>
            <p className="mt-2 text-xs leading-5 text-amber-50/65">
              HomeAtlas is refusing to display a false zero. The open lead queue
              remains usable while this proof source recovers.
            </p>
            <button
              type="button"
              onClick={onRefresh}
              className="mt-4 min-h-11 rounded-full border border-amber-100/25 px-4 text-[10px] font-bold uppercase tracking-[0.12em]"
            >
              Check again
            </button>
          </div>
        ) : handoffs && handoffs.records.length > 0 ? (
          <div className="mt-6 grid gap-3 lg:grid-cols-2">
            {handoffs.records.map((handoff) => (
              <SignedHandoffCard
                key={handoff.attributionId}
                handoff={handoff}
                onAccepted={onAccepted}
              />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-white/[0.07] bg-black/20 px-5 py-9 text-center">
            <p className="font-serif text-2xl text-[#f5f2eb]">
              The first verified close will land here automatically.
            </p>
            <p className="mx-auto mt-2 max-w-xl text-xs leading-5 text-white/38">
              No manual close counter and no duplicate customer record—the signed
              agreement is the evidence.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function OwnerSalesInboxContent() {
  const [snapshot, setSnapshot] = useState<OwnerSalesPipelineSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [repSlug, setRepSlug] = useState("all");
  const [moment, setMoment] = useState<"all" | SalesLeadActionMoment>("all");

  const load = useCallback(async (options?: {
    signal?: AbortSignal;
    silent?: boolean;
  }) => {
    const signal = options?.signal;
    const silent = options?.silent ?? false;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/sales/pipeline", {
        headers: getAdminRequestHeaders(),
        cache: "no-store",
        signal,
      });
      const body = (await response.json().catch(() => null)) as
        | OwnerSalesPipelineSnapshot
        | { error?: string }
        | null;
      if (!response.ok || !body || !("summary" in body)) {
        throw new Error(
          body && "error" in body
            ? body.error ?? "The private sales pipeline could not load."
            : "The private sales pipeline could not load.",
        );
      }
      setSnapshot(body);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") {
        return;
      }
      setError(
        loadError instanceof Error
          ? loadError.message
          : "The private sales pipeline could not load.",
      );
    } finally {
      if (!signal?.aborted && !silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void load({ signal: controller.signal });
    }, 0);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [load]);

  const refreshPendingPayments = useCallback(
    () => load({ silent: true }),
    [load],
  );
  const hasPendingPaymentHandoff = Boolean(
    snapshot?.handoffs?.records.some(
      (handoff) => handoff.stage === "payment_pending",
    ),
  );
  usePaymentHandoffRefresh({
    enabled: hasPendingPaymentHandoff,
    refresh: refreshPendingPayments,
  });

  useEffect(() => {
    if (!snapshot || !window.location.hash) return;
    const target = document.getElementById(window.location.hash.slice(1));
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [snapshot]);

  const visibleLeads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (snapshot?.leads ?? []).filter((lead) => {
      if (repSlug !== "all" && lead.repSlug !== repSlug) return false;
      if (moment !== "all" && lead.actionMoment !== moment) return false;
      if (!normalizedQuery) return true;
      return [
        lead.fullName,
        lead.propertyAddress,
        lead.phone,
        lead.email,
        lead.repDisplayName,
      ].some((value) => value?.toLowerCase().includes(normalizedQuery));
    });
  }, [moment, query, repSlug, snapshot]);

  async function handleSaved(message: string) {
    setNotice(message);
    await load();
  }

  return (
    <AmbientStage className="min-h-screen px-4 py-8 text-foreground sm:px-6 sm:py-12">
      <div className="relative mx-auto max-w-6xl">
        <HqFounderNav />

        <MotionReveal className="mt-10 overflow-hidden rounded-[2rem] border border-accent/15 bg-[radial-gradient(circle_at_82%_12%,rgba(201,184,150,0.14),transparent_34%),linear-gradient(145deg,rgba(20,18,14,0.96),rgba(7,7,7,0.98))] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.36)] sm:p-9">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[10px] uppercase tracking-[0.25em] text-accent/70">
                Owner + field revenue loop
              </p>
              <h1 className="mt-4 font-serif text-4xl font-light leading-[1.02] text-[#f5f2eb] sm:text-6xl">
                Every lead has an owner and a next move.
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-relaxed text-white/52 sm:text-base">
                See David and every active rep in one private queue, preserve the
                doorstep context, and resume the exact presentation without
                rebuilding the customer.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.045] p-5 lg:max-w-xs">
              <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-200/65">
                Safe operating boundary
              </p>
              <p className="mt-2 text-sm leading-relaxed text-white/48">
                Editing a lead or opening a handoff never contacts a customer. Only
                a clearly labeled email button sends, and Stripe card setup never
                takes a payment.
              </p>
            </div>
          </div>
        </MotionReveal>

        {notice ? (
          <div
            aria-live="polite"
            className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.07] px-4 py-3 text-sm text-emerald-100"
          >
            {notice}
          </div>
        ) : null}
        {error ? (
          <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/[0.07] px-4 py-3 text-sm text-red-200">
            {error}
            <button type="button" onClick={() => void load()} className="ml-2 underline">
              Try again
            </button>
          </div>
        ) : null}

        <SalesPhoneAccessPanel />

        <section className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat
            label="Active reps"
            value={loading ? "…" : String(snapshot?.summary.activeRepCount ?? 0)}
            hint="Private field workspaces"
          />
          <Stat
            label="Open people"
            value={loading ? "…" : String(snapshot?.summary.openLeadCount ?? 0)}
            hint="Complete active queue"
          />
          <Stat
            label="Potential ARR"
            value={loading ? "…" : money(snapshot?.summary.pipelineArrCents ?? 0)}
            hint="Directional until signed"
          />
          <Stat
            label="Due now"
            value={loading ? "…" : String(snapshot?.summary.dueNowCount ?? 0)}
            hint="Overdue + today"
          />
          <Stat
            label="Needs next move"
            value={loading ? "…" : String(snapshot?.summary.unscheduledCount ?? 0)}
            hint="No follow-up scheduled"
          />
        </section>

        {snapshot?.reps.length ? (
          <section className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {snapshot.reps.map((rep) => (
              <button
                type="button"
                key={rep.id}
                onClick={() => setRepSlug((current) => (current === rep.slug ? "all" : rep.slug))}
                aria-pressed={repSlug === rep.slug}
                className={`rounded-2xl border p-4 text-left transition active:scale-[0.99] ${
                  repSlug === rep.slug
                    ? "border-accent/35 bg-accent/[0.08]"
                    : "border-white/[0.08] bg-white/[0.025] hover:bg-white/[0.045]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-[#f5f2eb]">{rep.displayName}</p>
                    <p className="mt-1 text-xs text-white/38">{rep.roleTitle}</p>
                  </div>
                  <span className="rounded-full bg-black/25 px-2.5 py-1 text-[10px] text-white/48">
                    {rep.openLeadCount} open
                  </span>
                </div>
                <div className="mt-4 flex gap-4 text-xs text-white/45">
                  <span>{money(rep.pipelineArrCents)}</span>
                  <span>{rep.dueNowCount} due now</span>
                  <span>{rep.unscheduledCount} unscheduled</span>
                </div>
              </button>
            ))}
          </section>
        ) : null}

        <SignedHandoffDesk
          snapshot={snapshot}
          loading={loading}
          onRefresh={() => void load()}
          onAccepted={handleSaved}
        />

        <section className="mt-10">
          <div className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-black/20 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {MOMENT_FILTERS.map((filter) => (
                <button
                  type="button"
                  key={filter.value}
                  onClick={() => setMoment(filter.value)}
                  aria-pressed={moment === filter.value}
                  className={`min-h-10 rounded-xl px-3 text-xs transition ${
                    moment === filter.value
                      ? "bg-accent text-background"
                      : "border border-white/10 bg-white/[0.035] text-white/58 hover:bg-white/[0.07]"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <label className="min-w-0 lg:w-72">
              <span className="sr-only">Search sales leads</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, address, phone…"
                className="min-h-11 w-full rounded-xl border border-white/10 bg-[#11100e] px-4 text-sm text-white outline-none placeholder:text-white/28 focus:border-accent/45"
              />
            </label>
          </div>

          {loading ? (
            <p className="py-16 text-center text-sm text-white/40">
              Loading the complete private sales queue…
            </p>
          ) : snapshot && visibleLeads.length > 0 ? (
            <div className="mt-5 space-y-4">
              {visibleLeads.map((lead) => (
                <LeadActionCard
                  key={`${lead.id}:${lead.updatedAt}`}
                  lead={lead}
                  onSaved={handleSaved}
                />
              ))}
            </div>
          ) : snapshot?.summary.openLeadCount === 0 ? (
            <GlassCard tone="subtle" className="mt-5 px-6 py-14 text-center">
              <p className="font-serif text-3xl font-light text-[#f5f2eb]">
                The field queue is waiting for its first real homeowner.
              </p>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/42">
                Activate the rep&apos;s phone above, then the first saved homeowner will
                appear here with ownership, consent, potential ARR, and a next action.
              </p>
              <a
                href="#sales-phone-access"
                className="mt-5 inline-flex min-h-11 items-center rounded-full border border-emerald-300/25 bg-emerald-300/[0.07] px-5 text-xs font-semibold text-emerald-100"
              >
                Set up a field phone
              </a>
            </GlassCard>
          ) : (
            <GlassCard tone="subtle" className="mt-5 px-6 py-12 text-center">
              <p className="text-sm text-white/48">No leads match these filters.</p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setRepSlug("all");
                  setMoment("all");
                }}
                className="mt-3 text-xs text-accent underline underline-offset-4"
              >
                Clear filters
              </button>
            </GlassCard>
          )}
        </section>
      </div>
    </AmbientStage>
  );
}

export function OwnerSalesInboxPage() {
  const [unlocked, setUnlocked] = useAdminUnlockedState();
  if (!unlocked) return <AdminPinGate onUnlock={() => setUnlocked(true)} />;
  return <OwnerSalesInboxContent />;
}
