"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MemberAppointmentSummary } from "@/lib/member-intelligence/types";
import { getMembershipActionHeaders } from "@/lib/membership/action-client";
import {
  CUSTOMER_SERVICE_CASE_CATEGORIES,
  CUSTOMER_SERVICE_CASE_CATEGORY_LABELS,
  CUSTOMER_SERVICE_CASE_STATUS_LABELS,
  type CustomerServiceCaseCategory,
  type CustomerServiceCasePortalView,
} from "@/lib/service-cases/customer-service-case";
import { craftPrimaryButton, craftSecondaryButton } from "@/lib/craft/tokens";
import { PortalCard, PortalSection } from "@/components/portal/portal-section";

const CASE_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  month: "short",
  day: "numeric",
  year: "numeric",
});

function appointmentLabel(appointment: MemberAppointmentSummary): string {
  const service = appointment.serviceType
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  return `${CASE_DATE_FORMATTER.format(new Date(appointment.date))} · ${service}`;
}

function caseStatusTone(status: CustomerServiceCasePortalView["status"]): string {
  if (status === "resolved") return "border-emerald-400/25 text-emerald-200";
  if (status === "dismissed") return "border-white/10 text-muted";
  if (status === "acknowledged") return "border-sky-400/25 text-sky-200";
  return "border-amber-400/25 text-amber-100";
}

export function MemberServiceHelp({
  portalToken,
  appointments,
}: {
  portalToken: string;
  appointments: MemberAppointmentSummary[];
}) {
  const [serviceCases, setServiceCases] = useState<
    CustomerServiceCasePortalView[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [category, setCategory] =
    useState<CustomerServiceCaseCategory>("service_quality");
  const [appointmentId, setAppointmentId] = useState("");
  const [details, setDetails] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancellationOpen, setCancellationOpen] = useState(false);
  const pendingRequestId = useRef<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const selectableAppointments = useMemo(
    () =>
      [...appointments]
        .filter((appointment) => appointment.status !== "cancelled")
        .sort((left, right) => right.date.localeCompare(left.date))
        .slice(0, 8),
    [appointments],
  );

  const load = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const response = await fetch("/api/portal/service-cases", {
        headers: getMembershipActionHeaders(portalToken),
        cache: "no-store",
        signal: controller.signal,
      });
      const result = (await response.json()) as {
        serviceCases?: CustomerServiceCasePortalView[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error ?? "Care requests could not load.");
      }
      setServiceCases(result.serviceCases ?? []);
    } catch (error) {
      if (!controller.signal.aborted) {
        setFeedback(
          error instanceof Error
            ? error.message
            : "Care requests could not load.",
        );
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [portalToken]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(initialLoad);
      requestRef.current?.abort();
    };
  }, [load]);

  const submit = useCallback(async () => {
    const normalizedDetails = details.trim();
    if (normalizedDetails.length < 10) {
      setFeedback("Please add a little more detail so our team can help.");
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    const clientRequestId =
      pendingRequestId.current ?? crypto.randomUUID();
    pendingRequestId.current = clientRequestId;
    try {
      const headers = getMembershipActionHeaders(portalToken);
      headers.set("Content-Type", "application/json");
      const response = await fetch("/api/portal/service-cases", {
        method: "POST",
        headers,
        body: JSON.stringify({
          clientRequestId,
          category,
          appointmentId: appointmentId || null,
          details: normalizedDetails,
        }),
      });
      const result = (await response.json()) as {
        serviceCase?: CustomerServiceCasePortalView;
        error?: string;
      };
      if (!response.ok || !result.serviceCase) {
        throw new Error(result.error ?? "Your care request could not be saved.");
      }
      setServiceCases((current) => [
        result.serviceCase!,
        ...current.filter((item) => item.id !== result.serviceCase!.id),
      ]);
      pendingRequestId.current = null;
      setDetails("");
      setAppointmentId("");
      setFormOpen(false);
      setFeedback(
        "We received your request. A person on the SqueegeeKing team will review it and follow up.",
      );
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : "Your care request could not be saved.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [appointmentId, category, details, portalToken]);

  const submitCancellation = useCallback(async () => {
    setSubmitting(true);
    setFeedback(null);
    try {
      const headers = getMembershipActionHeaders(portalToken);
      headers.set("Content-Type", "application/json");
      const response = await fetch("/api/portal/service-cases", {
        method: "POST",
        headers,
        body: JSON.stringify({
          clientRequestId: crypto.randomUUID(),
          category: "membership_cancellation",
          appointmentId: null,
          details:
            "Customer submitted a written membership cancellation request through their private HomeAtlas portal.",
        }),
      });
      const result = (await response.json()) as {
        serviceCase?: CustomerServiceCasePortalView;
        error?: string;
      };
      if (!response.ok || !result.serviceCase) {
        throw new Error(result.error ?? "Your cancellation request could not be saved.");
      }
      setServiceCases((current) => [
        result.serviceCase!,
        ...current.filter((item) => item.id !== result.serviceCase!.id),
      ]);
      setCancellationOpen(false);
      setFeedback(
        "Your written cancellation request is timestamped and on file. The SqueegeeKing team will confirm the effective date and final account details.",
      );
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : "Your cancellation request could not be saved.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [portalToken]);

  return (
    <PortalSection
      id="care-help"
      index={5}
      eyebrow="Member care"
      headline="Need a hand?"
      support="Send a private note to the SqueegeeKing team about a visit, schedule, or account question."
    >
      {feedback ? (
        <div
          className="mb-4 rounded-xl border border-accent/20 bg-accent/[0.06] px-4 py-3 text-sm leading-6 text-foreground/80"
          role="status"
          aria-live="polite"
        >
          {feedback}
        </div>
      ) : null}

      {loading ? (
        <PortalCard>
          <p className="text-sm text-foreground/55">Checking your care requests…</p>
        </PortalCard>
      ) : serviceCases.length > 0 ? (
        <ul className="mb-4 space-y-3">
          {serviceCases.slice(0, 3).map((serviceCase) => (
            <li key={serviceCase.id}>
              <PortalCard>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground/90">
                      {CUSTOMER_SERVICE_CASE_CATEGORY_LABELS[serviceCase.category]}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Sent {CASE_DATE_FORMATTER.format(new Date(serviceCase.createdAt))}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] ${caseStatusTone(serviceCase.status)}`}
                  >
                    {CUSTOMER_SERVICE_CASE_STATUS_LABELS[serviceCase.status]}
                  </span>
                </div>
                <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-foreground/60">
                  {serviceCase.details}
                </p>
              </PortalCard>
            </li>
          ))}
        </ul>
      ) : null}

      {!formOpen ? (
        <button
          type="button"
          onClick={() => {
            setFormOpen(true);
            setFeedback(null);
          }}
          className={`w-full ${craftSecondaryButton} !normal-case !tracking-[0.06em]`}
        >
          Send a care request
        </button>
      ) : (
        <PortalCard className="space-y-4">
          <label className="block text-xs font-medium uppercase tracking-[0.12em] text-foreground/60">
            What can we help with?
            <select
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as CustomerServiceCaseCategory)
              }
              className="mt-2 w-full rounded-xl border border-border/70 bg-background/70 px-3.5 py-3 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:border-accent/45"
            >
              {CUSTOMER_SERVICE_CASE_CATEGORIES.filter(
                (value) => value !== "membership_cancellation",
              ).map((value) => (
                <option key={value} value={value}>
                  {CUSTOMER_SERVICE_CASE_CATEGORY_LABELS[value]}
                </option>
              ))}
            </select>
          </label>

          {selectableAppointments.length > 0 ? (
            <label className="block text-xs font-medium uppercase tracking-[0.12em] text-foreground/60">
              Related visit (optional)
              <select
                value={appointmentId}
                onChange={(event) => setAppointmentId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-border/70 bg-background/70 px-3.5 py-3 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:border-accent/45"
              >
                <option value="">Not tied to a visit</option>
                {selectableAppointments.map((appointment) => (
                  <option key={appointment.id} value={appointment.id}>
                    {appointmentLabel(appointment)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="block text-xs font-medium uppercase tracking-[0.12em] text-foreground/60">
            Tell us what happened
            <textarea
              value={details}
              onChange={(event) => setDetails(event.target.value.slice(0, 2000))}
              rows={5}
              minLength={10}
              maxLength={2000}
              placeholder="Share the details our team should know…"
              className="mt-2 w-full resize-y rounded-xl border border-border/70 bg-background/70 px-3.5 py-3 text-sm font-normal normal-case tracking-normal text-foreground outline-none placeholder:text-muted/45 focus:border-accent/45"
            />
            <span className="mt-1 block text-right font-mono text-[10px] normal-case tracking-normal text-muted/60">
              {details.length}/2000
            </span>
          </label>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={submitting || details.trim().length < 10}
              onClick={() => void submit()}
              className={`flex-1 ${craftPrimaryButton} disabled:cursor-wait disabled:opacity-45`}
            >
              {submitting ? "Sending…" : "Send privately"}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setFormOpen(false);
                setFeedback(null);
              }}
              className={`flex-1 ${craftSecondaryButton}`}
            >
              Cancel
            </button>
          </div>
          <p className="text-xs leading-5 text-muted">
            This creates a private HomeAtlas care case for the team. It does not
            post publicly or send an automated message.
          </p>
        </PortalCard>
      )}

      <div className="mt-6 border-t border-border/70 pt-5">
        {!cancellationOpen ? (
          <button
            type="button"
            onClick={() => {
              setCancellationOpen(true);
              setFeedback(null);
            }}
            className="text-xs text-muted underline decoration-border underline-offset-4 transition hover:text-foreground"
          >
            Request membership cancellation
          </button>
        ) : (
          <PortalCard className="space-y-4 border-amber-300/15">
            <div>
              <p className="font-serif text-lg text-foreground">
                Send a written cancellation request?
              </p>
              <p className="mt-2 text-xs leading-5 text-muted">
                This records your request immediately. Our team will confirm the
                effective date, any services already scheduled, and any terms in
                your signed Service &amp; Quote Agreement. You do not need to give
                a reason.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={submitting}
                onClick={() => void submitCancellation()}
                className={`flex-1 ${craftPrimaryButton} disabled:cursor-wait disabled:opacity-45`}
              >
                {submitting ? "Recording…" : "Send cancellation request"}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setCancellationOpen(false)}
                className={`flex-1 ${craftSecondaryButton}`}
              >
                Keep my plan
              </button>
            </div>
          </PortalCard>
        )}
      </div>
    </PortalSection>
  );
}
