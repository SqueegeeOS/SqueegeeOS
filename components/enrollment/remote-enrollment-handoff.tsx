"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import {
  enrollmentPacketProgress,
  type EnrollmentPacketProgressTone,
} from "@/lib/enrollment/packet-progress";
import type {
  EnrollmentPacketStatusSnapshot,
  EnrollmentSalesContext,
} from "@/lib/enrollment/types";
import { SQUEEGEEKING_TIERS } from "@/lib/membership/tier-config";
import type { PresentationData, PresentationTier } from "@/lib/presentations/types";
import type { PaymentRail } from "@/lib/billing/payment-rail";

interface ReadinessPayload {
  checks?: Array<{
    id: string;
    label: string;
    ready: boolean;
    detail: string;
  }>;
}

interface EnrollmentPreflightPayload {
  mode: "no_side_effects";
  readyToSend: boolean;
  snapshotSha256: string;
  summary: {
    tierLabel: string;
    visitsPerYear: number;
    paymentRail: PaymentRail;
    signatureProvider: "homeatlas_native" | "docusign";
  };
  checks: Array<{
    id: string;
    label: string;
    ready: boolean;
    detail: string;
  }>;
}

function price(value: number): string {
  return Number.isFinite(value) && value > 0 ? value.toFixed(2) : "";
}

const PROGRESS_TONE_CLASS: Record<EnrollmentPacketProgressTone, string> = {
  neutral: "border-white/12 bg-white/[0.045] text-white/70",
  accent: "border-accent/25 bg-accent/[0.075] text-accent",
  warning: "border-amber-300/25 bg-amber-300/[0.075] text-amber-100",
  success: "border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-100",
};

export function RemoteEnrollmentHandoff({
  presentation,
  tier,
  firstVisitPrice,
  recurringVisitPrice,
  annualizedValue,
  returnTo = null,
}: {
  presentation: PresentationData;
  tier: PresentationTier;
  firstVisitPrice: number;
  recurringVisitPrice: number;
  annualizedValue: number;
  returnTo?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [firstRate, setFirstRate] = useState(() => price(firstVisitPrice));
  const [recurringRate, setRecurringRate] = useState(() =>
    price(recurringVisitPrice),
  );
  const [firstYearTotal, setFirstYearTotal] = useState(() =>
    price(annualizedValue),
  );
  const [context, setContext] = useState<EnrollmentSalesContext | null>(null);
  const [noticeDays, setNoticeDays] = useState<3 | 5 | null>(null);
  const [paymentRail, setPaymentRail] =
    useState<PaymentRail>("stripe_card");
  const [sending, setSending] = useState(false);
  const [preflighting, setPreflighting] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [packetStatus, setPacketStatus] =
    useState<EnrollmentPacketStatusSnapshot | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<ReadinessPayload | null>(null);
  const [preflight, setPreflight] = useState<{
    inputKey: string;
    report: EnrollmentPreflightPayload;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const loadStatus = async () => {
      try {
        const params = new URLSearchParams({ presentationId: presentation.id });
        const response = await fetch(`/api/admin/enrollment-packets?${params}`, {
          headers: getAdminRequestHeaders(),
          cache: "no-store",
          signal: controller.signal,
        });
        const body = (await response.json().catch(() => null)) as {
          packet?: EnrollmentPacketStatusSnapshot | null;
          error?: string;
        } | null;
        if (!response.ok) {
          throw new Error(
            body?.error ?? "Previous secure handoff progress could not be checked.",
          );
        }
        const nextStatus = body?.packet ?? null;
        setPacketStatus(nextStatus);
        if (nextStatus) setPaymentRail(nextStatus.paymentRail);
        if (
          nextStatus &&
          !enrollmentPacketProgress(nextStatus.status).blocksNewSend
        ) {
          setExpanded(true);
        }
      } catch (statusLoadError) {
        if (statusLoadError instanceof DOMException && statusLoadError.name === "AbortError") {
          return;
        }
        setStatusError(
          statusLoadError instanceof Error
            ? statusLoadError.message
            : "Previous secure handoff progress could not be checked.",
        );
      } finally {
        if (!controller.signal.aborted) setCheckingStatus(false);
      }
    };

    void loadStatus();
    return () => controller.abort();
  }, [presentation.id]);

  const submissionPayload = () => ({
    presentationId: presentation.id,
    tier,
    firstVisitPrice: Number(firstRate),
    recurringVisitPrice: Number(recurringRate),
    annualizedValue: Number(firstYearTotal),
    salesContext: context,
    homeSolicitationNoticeDays:
      context === "customer_home" ? noticeDays : null,
    paymentRail,
    signatureProvider: "homeatlas_native" as const,
  });

  const send = async () => {
    setSending(true);
    setError(null);
    setReadiness(null);
    try {
      const response = await fetch("/api/admin/enrollment-packets", {
        method: "POST",
        headers: getAdminRequestHeaders(),
        body: JSON.stringify(submissionPayload()),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        readiness?: ReadinessPayload;
        status?: "signature_sent";
      } | null;
      if (!response.ok) {
        setReadiness(body?.readiness ?? null);
        throw new Error(body?.error ?? "The secure handoff could not be sent.");
      }
      setPacketStatus({
        status: body?.status ?? "signature_sent",
        paymentRail,
        updatedAt: new Date().toISOString(),
      });
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "The secure handoff could not be sent.",
      );
    } finally {
      setSending(false);
    }
  };

  const runPreflight = async () => {
    setPreflighting(true);
    setError(null);
    setReadiness(null);
    const payload = submissionPayload();
    const inputKey = JSON.stringify(payload);
    try {
      const response = await fetch("/api/admin/enrollment/preflight", {
        method: "POST",
        headers: getAdminRequestHeaders(),
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => null)) as {
        report?: EnrollmentPreflightPayload;
        error?: string;
      } | null;
      if (!response.ok || !body?.report) {
        throw new Error(
          body?.error ?? "The no-send enrollment rehearsal could not run.",
        );
      }
      setPreflight({ inputKey, report: body.report });
    } catch (preflightError) {
      setError(
        preflightError instanceof Error
          ? preflightError.message
          : "The no-send enrollment rehearsal could not run.",
      );
    } finally {
      setPreflighting(false);
    }
  };

  if (checkingStatus) {
    return (
      <div
        className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-left"
        aria-live="polite"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/42">
          Checking secure handoff
        </p>
        <p className="mt-2 text-xs leading-relaxed text-white/48">
          Restoring the last verified signature and payment step…
        </p>
      </div>
    );
  }

  const durableProgress = packetStatus
    ? enrollmentPacketProgress(packetStatus.status, packetStatus.paymentRail)
    : null;
  const progressHref = returnTo ?? "/hq/enrollment";
  const progressHrefLabel = returnTo
    ? "Return to field desk"
    : "Open Enrollment Desk";

  if (durableProgress && packetStatus && durableProgress.blocksNewSend) {
    return (
      <div
        className={`rounded-2xl border p-5 text-left ${PROGRESS_TONE_CLASS[durableProgress.tone]}`}
        aria-live="polite"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-75">
          {durableProgress.eyebrow}
        </p>
        <h3 className="mt-2 font-serif text-xl font-light text-white">
          {durableProgress.title}
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-white/55">
          {durableProgress.detail}
        </p>
        {packetStatus.status === "signature_sent" ? (
          <p className="mt-3 text-xs leading-relaxed text-white/45">
            HomeAtlas sent the private agreement link for {presentation.clientName} to {presentation.clientEmail}.
          </p>
        ) : null}
        <Link
          href={progressHref}
          className="mt-4 inline-flex text-xs font-semibold text-accent hover:underline"
        >
          {progressHrefLabel} →
        </Link>
      </div>
    );
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="group w-full rounded-2xl border border-accent/25 bg-accent/[0.07] p-5 text-left transition hover:border-accent/45 hover:bg-accent/[0.1]"
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent/75">
          Fast phone handoff · recommended
        </span>
        <span className="mt-2 block font-serif text-xl font-light text-white">
          Email one simple agreement link.
        </span>
        <span className="mt-2 block text-xs leading-relaxed text-white/48">
          The customer opens their exact plan, signs once, and they&apos;re done. No card details pass through HomeAtlas.
        </span>
        <span className="mt-4 inline-flex text-xs font-semibold text-accent">
          Prepare secure handoff <span className="ml-2 transition group-hover:translate-x-1">→</span>
        </span>
      </button>
    );
  }

  const canSend =
    Boolean(context) &&
    (context !== "customer_home" || noticeDays !== null) &&
    Number(firstRate) > 0 &&
    Number(recurringRate) > 0 &&
    Number(firstYearTotal) > 0;
  const activePreflight =
    preflight?.inputKey === JSON.stringify(submissionPayload())
      ? preflight.report
      : null;
  const recalculateFirstYear = (nextFirst: string, nextRecurring: string) => {
    const first = Number(nextFirst);
    const recurring = Number(nextRecurring);
    if (first > 0 && recurring > 0) {
      const visitCount = SQUEEGEEKING_TIERS[tier].visitsPerYear;
      setFirstYearTotal(price(first + recurring * (visitCount - 1)));
    }
  };

  return (
    <div className="rounded-2xl border border-accent/25 bg-accent/[0.06] p-5 text-left">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent/75">
            Secure customer handoff
          </p>
          <h3 className="mt-2 font-serif text-xl font-light text-white">
            Clear, separate, trusted.
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="rounded-full border border-white/10 px-3 py-1.5 text-[10px] text-white/45 hover:text-white"
        >
          Collapse
        </button>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-white/48">
        HomeAtlas emails one private plan link. The customer sees the plain-English plan, draws one signature, and taps Sign and accept. The selected payment arrangement starts only after that signature is safely recorded.
      </p>

      <fieldset className="mt-5">
        <legend className="text-[10px] uppercase tracking-[0.14em] text-white/40">
          Payment arrangement
        </legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setPaymentRail("stripe_card")}
            className={`min-h-14 rounded-xl border px-3 text-left text-xs ${
              paymentRail === "stripe_card"
                ? "border-accent/45 bg-accent/12 text-accent"
                : "border-white/10 text-white/45"
            }`}
          >
            <span className="block font-semibold">Secure card on Stripe</span>
            <span className="mt-1 block text-[10px] opacity-70">
              Default · supports approved automatic billing
            </span>
          </button>
          <button
            type="button"
            onClick={() => setPaymentRail("manual_cash_check")}
            className={`min-h-14 rounded-xl border px-3 text-left text-xs ${
              paymentRail === "manual_cash_check"
                ? "border-emerald-300/40 bg-emerald-300/[0.09] text-emerald-100"
                : "border-white/10 text-white/45"
            }`}
          >
            <span className="block font-semibold">Cash or check account</span>
            <span className="mt-1 block text-[10px] opacity-70">
              Owner-only · never enters automatic charges
            </span>
          </button>
        </div>
      </fieldset>

      {durableProgress ? (
        <div
          className={`mt-4 rounded-xl border p-3 ${PROGRESS_TONE_CLASS[durableProgress.tone]}`}
          role="status"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] opacity-75">
            {durableProgress.eyebrow}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-white/62">
            {durableProgress.detail}
          </p>
        </div>
      ) : null}

      {statusError ? (
        <p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-3 text-xs leading-relaxed text-amber-100">
          {statusError} The send remains server-protected and idempotent.
        </p>
      ) : null}

      <div className="mt-5 grid grid-cols-2 gap-3">
        <label className="text-[10px] uppercase tracking-[0.14em] text-white/40">
          First visit
          <span className="mt-2 flex min-h-11 items-center rounded-xl border border-white/10 bg-black/20 px-3 text-sm normal-case tracking-normal text-white/80 focus-within:border-accent/40">
            $<input
              value={firstRate}
              onChange={(event) => {
                setFirstRate(event.target.value);
                recalculateFirstYear(event.target.value, recurringRate);
              }}
              inputMode="decimal"
              className="min-w-0 flex-1 bg-transparent px-1 outline-none"
              aria-label="First visit rate"
            />
          </span>
        </label>
        <label className="text-[10px] uppercase tracking-[0.14em] text-white/40">
          Continuing visit
          <span className="mt-2 flex min-h-11 items-center rounded-xl border border-white/10 bg-black/20 px-3 text-sm normal-case tracking-normal text-white/80 focus-within:border-accent/40">
            $<input
              value={recurringRate}
              onChange={(event) => {
                setRecurringRate(event.target.value);
                recalculateFirstYear(firstRate, event.target.value);
              }}
              inputMode="decimal"
              className="min-w-0 flex-1 bg-transparent px-1 outline-none"
              aria-label="Continuing visit rate"
            />
          </span>
        </label>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl border border-white/[0.08] bg-black/15 px-4 py-3">
        <span className="text-[10px] uppercase tracking-[0.14em] text-white/38">
          First-year agreement total
        </span>
        <strong className="font-serif text-lg font-light text-white/80">
          ${firstYearTotal || "—"}
        </strong>
      </div>

      <fieldset className="mt-5">
        <legend className="text-[10px] uppercase tracking-[0.14em] text-white/40">
          Where was the agreement made?
        </legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setContext("customer_home");
              setNoticeDays(null);
            }}
            className={`min-h-11 rounded-xl border px-3 text-xs ${
              context === "customer_home"
                ? "border-accent/45 bg-accent/12 text-accent"
                : "border-white/10 text-white/45"
            }`}
          >
            At their home
          </button>
          <button
            type="button"
            onClick={() => {
              setContext("remote");
              setNoticeDays(null);
            }}
            className={`min-h-11 rounded-xl border px-3 text-xs ${
              context === "remote"
                ? "border-accent/45 bg-accent/12 text-accent"
                : "border-white/10 text-white/45"
            }`}
          >
            Remote / office
          </button>
        </div>
      </fieldset>

      {context === "customer_home" ? (
        <fieldset className="mt-4 rounded-xl border border-white/10 bg-black/15 p-3">
          <legend className="px-1 text-[10px] uppercase tracking-[0.14em] text-white/40">
            California cancellation notice
          </legend>
          <label className="mt-1 flex cursor-pointer items-center gap-2 text-xs text-white/60">
            <input
              type="radio"
              checked={noticeDays === 3}
              onChange={() => setNoticeDays(3)}
              className="accent-accent"
            />
            Standard buyer · 3 business days
          </label>
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-white/60">
            <input
              type="radio"
              checked={noticeDays === 5}
              onChange={() => setNoticeDays(5)}
              className="accent-accent"
            />
            Senior buyer · 5 business days
          </label>
        </fieldset>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.07] p-3">
          <p className="text-xs leading-relaxed text-amber-100">{error}</p>
          {readiness?.checks ? (
            <ul className="mt-3 space-y-1.5 text-[11px] text-white/45">
              {readiness.checks
                .filter((check) => !check.ready)
                .map((check) => (
                  <li key={check.id}>• {check.label}: {check.detail}</li>
                ))}
            </ul>
          ) : null}
          <Link
            href={progressHref}
            className="mt-3 inline-flex text-xs font-semibold text-accent hover:underline"
          >
            {progressHrefLabel} →
          </Link>
        </div>
      ) : null}

      <button
        type="button"
        onClick={runPreflight}
        disabled={!canSend || preflighting || sending}
        className="mt-5 min-h-12 w-full rounded-xl border border-white/12 bg-white/[0.045] px-5 text-sm font-semibold text-white/75 transition hover:border-accent/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
      >
        {preflighting
          ? "Checking the exact handoff…"
          : "Run no-send rehearsal"}
      </button>
      <p className="mt-2 text-center text-[10px] leading-relaxed text-white/30">
        Validates this exact customer, plan, scope, prices, authority, and every
        launch gate. Creates nothing and contacts nobody.
      </p>

      {activePreflight ? (
        <div
          className={`mt-4 rounded-xl border p-4 ${
            activePreflight.readyToSend
              ? "border-emerald-300/25 bg-emerald-300/[0.07]"
              : "border-amber-300/20 bg-amber-300/[0.055]"
          }`}
          role="status"
        >
          <p
            className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${
              activePreflight.readyToSend
                ? "text-emerald-200"
                : "text-amber-100"
            }`}
          >
            {activePreflight.readyToSend
              ? "Exact handoff ready"
              : "Deal valid · launch gate paused"}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-white/58">
            {activePreflight.summary.tierLabel} ·{" "}
            {activePreflight.summary.visitsPerYear} visits ·{" "}
            {activePreflight.summary.paymentRail === "manual_cash_check"
              ? "cash / check"
              : "Stripe card"}
          </p>
          <p className="mt-2 break-all font-mono text-[9px] leading-relaxed text-white/35">
            PRE-FLIGHT SHA-256 {activePreflight.snapshotSha256}
          </p>
          {!activePreflight.readyToSend ? (
            <ul className="mt-3 space-y-2 border-t border-white/[0.07] pt-3">
              {activePreflight.checks
                .filter((check) => !check.ready)
                .map((check) => (
                  <li key={check.id} className="text-[11px] leading-relaxed text-white/48">
                    <strong className="text-white/68">{check.label}:</strong>{" "}
                    {check.detail}
                  </li>
                ))}
            </ul>
          ) : (
            <p className="mt-3 border-t border-white/[0.07] pt-3 text-[11px] leading-relaxed text-emerald-100/75">
              Every server gate is green. Nothing was sent; use the separate
              send button only when the intended recipient is confirmed.
            </p>
          )}
          <p className="mt-3 text-[10px] leading-relaxed text-white/32">
            Proof: no packet row, database write, signature record, email,
            Stripe session, saved card, or charge was created.
          </p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={send}
        disabled={!canSend || sending || preflighting}
        className="mt-4 min-h-13 w-full rounded-xl border border-white/15 bg-[#f4efe6] px-5 text-sm font-bold text-[#173f32] shadow-[0_14px_34px_rgba(0,0,0,0.18)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
      >
        {sending
          ? "Preparing secure packet…"
          : durableProgress
            ? `${durableProgress.actionLabel} for ${presentation.clientEmail || "customer"}`
            : `Email secure packet to ${presentation.clientEmail || "customer"}`}
      </button>
      <p className="mt-3 text-center text-[10px] leading-relaxed text-white/28">
        {paymentRail === "manual_cash_check"
          ? "Owner approval is recorded with the packet. No Stripe customer, card link, or automatic charge is created."
          : "No agreement is sent unless the approved documents and every delivery check are green."}
      </p>
    </div>
  );
}
