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

interface ReadinessPayload {
  checks?: Array<{
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
  const [sending, setSending] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [packetStatus, setPacketStatus] =
    useState<EnrollmentPacketStatusSnapshot | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<ReadinessPayload | null>(null);

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

  const send = async () => {
    setSending(true);
    setError(null);
    setReadiness(null);
    try {
      const response = await fetch("/api/admin/enrollment-packets", {
        method: "POST",
        headers: getAdminRequestHeaders(),
        body: JSON.stringify({
          presentationId: presentation.id,
          tier,
          firstVisitPrice: Number(firstRate),
          recurringVisitPrice: Number(recurringRate),
          annualizedValue: Number(firstYearTotal),
          salesContext: context,
          homeSolicitationNoticeDays:
            context === "customer_home" ? noticeDays : null,
        }),
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
          Restoring the last verified signature and Stripe step…
        </p>
      </div>
    );
  }

  const durableProgress = packetStatus
    ? enrollmentPacketProgress(packetStatus.status)
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
            DocuSign sent the agreement for {presentation.clientName} to {presentation.clientEmail}.
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
          Email DocuSign, then Stripe.
        </span>
        <span className="mt-2 block text-xs leading-relaxed text-white/48">
          One owner tap starts a trustworthy customer flow on their own device. No card details pass through HomeAtlas.
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
        DocuSign emails the MSA plus the property quote. Stripe arrives only after the agreement is complete.
      </p>

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
        onClick={send}
        disabled={!canSend || sending}
        className="mt-5 min-h-13 w-full rounded-xl bg-gradient-to-br from-accent to-[#ead8ad] px-5 text-sm font-bold text-[#0b0b0a] disabled:cursor-not-allowed disabled:opacity-35"
      >
        {sending
          ? "Preparing secure packet…"
          : durableProgress
            ? `${durableProgress.actionLabel} for ${presentation.clientEmail || "customer"}`
            : `Email secure packet to ${presentation.clientEmail || "customer"}`}
      </button>
      <p className="mt-3 text-center text-[10px] leading-relaxed text-white/28">
        No agreement is sent unless the attorney-approved templates and every provider check are green.
      </p>
    </div>
  );
}
