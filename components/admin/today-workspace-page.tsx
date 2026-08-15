"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { HqFounderNav } from "@/components/admin/hq-founder-nav";
import { AmbientStage } from "@/components/craft/ambient-stage";
import { MotionReveal } from "@/components/craft/motion-reveal";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import { useAdminUnlockedState } from "@/lib/admin/use-admin-unlocked-state";
import {
  classifyJobberTodayVisit,
  isJobberTodayDataStale,
  type JobberTodayData,
  type JobberTodayVisit,
  type JobberTodayVisitMoment,
} from "@/lib/care-operations/jobber-today-types";
import { craftEyebrow, craftHeading } from "@/lib/craft/tokens";
import {
  classifyVisitFieldFollowUp,
  type VisitFieldFollowUpView,
} from "@/lib/field-records/visit-field-record";
import { readVisitFieldDraft } from "@/lib/field-records/visit-field-draft";
import {
  technicianVisitStageLabel,
  technicianVisitStageProgress,
} from "@/lib/field-operations/technician-visit-events";

const VisitFieldCapture = dynamic(
  () =>
    import("@/components/visit/visit-field-capture").then(
      (module) => module.VisitFieldCapture,
    ),
  {
    ssr: false,
    loading: () => (
      <p className="py-8 text-center text-xs text-muted">
        Opening the field record…
      </p>
    ),
  },
);

const MOMENT_STYLES: Record<
  JobberTodayVisitMoment,
  { label: string; className: string; dotClassName: string }
> = {
  complete: {
    label: "Complete",
    className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
    dotClassName: "bg-emerald-400",
  },
  in_progress: {
    label: "In progress",
    className: "border-accent/35 bg-accent/10 text-accent",
    dotClassName: "bg-accent",
  },
  late: {
    label: "Past scheduled time",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    dotClassName: "bg-amber-300",
  },
  upcoming: {
    label: "Upcoming",
    className: "border-border bg-foreground/[0.035] text-muted",
    dotClassName: "bg-muted",
  },
};

const FOLLOW_UP_MOMENT_STYLES = {
  overdue: {
    label: "Overdue",
    className: "border-red-400/30 bg-red-400/[0.08] text-red-200",
  },
  due_today: {
    label: "Due today",
    className: "border-amber-400/30 bg-amber-400/[0.08] text-amber-100",
  },
  upcoming: {
    label: "Upcoming",
    className: "border-border bg-foreground/[0.035] text-muted",
  },
} as const;
const FOLLOW_UP_DUE_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function formatCalendarDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(`${value}T12:00:00Z`));
}

function formatTime(value: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatTimeRange(visit: JobberTodayVisit, timezone: string): string {
  const start = formatTime(visit.scheduledStart, timezone);
  if (!visit.scheduledEnd) return start;
  return `${start} - ${formatTime(visit.scheduledEnd, timezone)}`;
}

function humanizeStatus(value: string | null): string | null {
  if (!value) return null;
  return value
    .toLocaleLowerCase("en-US")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toLocaleUpperCase("en-US"));
}

function formatSyncTime(value: string | null, timezone: string): string {
  if (!value) return "Never synced";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatFollowUpDueAt(value: string, timezone: string): string {
  let formatter = FOLLOW_UP_DUE_FORMATTERS.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    FOLLOW_UP_DUE_FORMATTERS.set(timezone, formatter);
  }
  return formatter.format(new Date(value));
}

function FieldFollowUpQueue({
  followUps,
  timezone,
  now,
  resolvingId,
  onResolve,
}: {
  followUps: VisitFieldFollowUpView[];
  timezone: string;
  now: Date;
  resolvingId: string | null;
  onResolve: (assessmentId: string) => void;
}) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  if (followUps.length === 0) return null;

  return (
    <section className="mb-8 overflow-hidden rounded-[2rem] border border-amber-400/25 bg-gradient-to-br from-amber-400/[0.09] via-background/75 to-background/60 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.18)] sm:p-7">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className={craftEyebrow}>Owner action queue</p>
          <h2 className="mt-2 font-serif text-2xl font-light text-foreground sm:text-3xl">
            Field follow-ups
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            The crew asked HQ to close these loops. Nothing leaves HomeAtlas
            automatically—review the home record, act, then mark it complete.
          </p>
        </div>
        <span className="self-start rounded-full border border-amber-300/25 bg-amber-300/[0.08] px-3 py-1.5 text-xs text-amber-100 sm:self-auto">
          {followUps.length} open
        </span>
      </div>

      <ul className="mt-5 grid gap-3 lg:grid-cols-2">
        {followUps.map((followUp) => {
          const moment = classifyVisitFieldFollowUp(followUp.dueAt, now);
          const style = FOLLOW_UP_MOMENT_STYLES[moment];
          const isResolving = resolvingId === followUp.assessmentId;
          const isConfirming = confirmingId === followUp.assessmentId;
          const actionLabel = isResolving
            ? "Completing…"
            : isConfirming
              ? "Tap again to complete"
              : "Mark complete";
          const context =
            followUp.internalNote?.trim() ||
            followUp.customerSummary?.trim() ||
            "Field team requested an HQ follow-up after this visit.";
          return (
            <li
              key={followUp.assessmentId}
              className="rounded-2xl border border-border/80 bg-background/75 p-4 backdrop-blur-xl sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-serif text-xl font-light text-foreground">
                    {followUp.homeownerName}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted">
                    {followUp.propertyName} · {followUp.propertyAddress}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] ${style.className}`}
                >
                  {style.label}
                </span>
              </div>

              <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-foreground/80">
                {context}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
                <span>Due {formatFollowUpDueAt(followUp.dueAt, timezone)}</span>
                <span aria-hidden>·</span>
                <span>Flagged by {followUp.technicianName}</span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2 border-t border-border/60 pt-4">
                <Link
                  href={`/hq/properties/${followUp.propertyId}/health`}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-3 text-xs text-muted transition hover:text-foreground"
                >
                  Open home record
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    if (isConfirming) {
                      onResolve(followUp.assessmentId);
                    } else {
                      setConfirmingId(followUp.assessmentId);
                    }
                  }}
                  disabled={resolvingId !== null}
                  aria-live="polite"
                  className={`min-h-11 rounded-xl border px-3 text-xs transition active:scale-[0.99] disabled:opacity-50 ${
                    isConfirming
                      ? "border-amber-300/40 bg-amber-300/[0.1] text-amber-100"
                      : "border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-200"
                  }`}
                >
                  {actionLabel}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function JobberVisitCard({
  visit,
  timezone,
  now,
  fieldRecordStatusAvailable,
  fieldEventStatusAvailable,
  onFieldRecordSaved,
}: {
  visit: JobberTodayVisit;
  timezone: string;
  now: Date;
  fieldRecordStatusAvailable: boolean;
  fieldEventStatusAvailable: boolean;
  onFieldRecordSaved: () => void;
}) {
  const propertyId = visit.homeAtlasPropertyId;
  const appointmentId = visit.homeAtlasAppointmentId;
  const [fieldCaptureOpen, setFieldCaptureOpen] = useState(false);
  const [hasFieldDraft, setHasFieldDraft] = useState(false);
  const fieldStageProgress = technicianVisitStageProgress(
    visit.homeAtlasFieldStage,
  );
  const moment = classifyJobberTodayVisit(visit, now);
  const style = MOMENT_STYLES[moment];
  const service = visit.title?.trim() || "Scheduled Jobber visit";
  const needsFieldCloseout =
    fieldRecordStatusAvailable &&
    visit.isComplete &&
    visit.homeAtlasFieldRecordCount === 0;
  const needsCustomerPortalUpdate =
    fieldRecordStatusAvailable &&
    visit.isComplete &&
    visit.homeAtlasFieldRecordCount > 0 &&
    visit.homeAtlasCustomerVisibleRecordCount === 0;
  const fieldActionLabel = fieldCaptureOpen
    ? "Close field record"
    : hasFieldDraft
      ? "Resume saved visit draft"
      : needsCustomerPortalUpdate
        ? "Add customer-facing update"
      : visit.homeAtlasFieldRecordCount > 0
        ? "Add another visit update"
        : "Add photos + visit notes";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setHasFieldDraft(
        Boolean(
          propertyId &&
            appointmentId &&
            readVisitFieldDraft(window.localStorage, {
              propertyId,
              appointmentId,
            }),
        ),
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [appointmentId, propertyId]);

  return (
    <article className="group grid overflow-hidden rounded-[1.75rem] border border-border/80 bg-background/70 shadow-[0_24px_70px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:grid-cols-[9.5rem_minmax(0,1fr)]">
      <div className="border-b border-border/60 bg-foreground/[0.025] px-5 py-5 sm:border-b-0 sm:border-r">
        <p className="font-serif text-2xl font-light text-foreground">
          {formatTime(visit.scheduledStart, timezone)}
        </p>
        <p className="mt-1 text-xs text-muted">
          {visit.scheduledEnd
            ? `until ${formatTime(visit.scheduledEnd, timezone)}`
            : "Start time"}
        </p>
        <span
          className={`mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] ${style.className}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${style.dotClassName}`} />
          {style.label}
        </span>
      </div>

      <div className="p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.19em] text-accent">
              {visit.jobNumber ? `Job #${visit.jobNumber}` : "Jobber visit"}
            </p>
            <h2 className="mt-2 font-serif text-2xl font-light text-foreground sm:text-3xl">
              {visit.clientName}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{service}</p>
            {visit.propertyLabel ? (
              <p className="mt-1 text-xs text-muted/80">{visit.propertyLabel}</p>
            ) : null}
            <p
              className={`mt-3 text-xs ${
                visit.assignmentReadState !== "available" ||
                visit.assignedUsers.length === 0
                  ? "text-amber-200"
                  : "text-muted"
              }`}
            >
              {visit.assignmentReadState !== "available"
                ? "Crew visibility unavailable"
                : visit.assignedUsers.length > 0
                  ? `Crew · ${visit.assignedUsers.map((user) => user.name).join(", ")}`
                  : "No technician assigned in Jobber"}
            </p>
            <p
              className={`mt-2 text-xs ${
                visit.scopeReadState === "available"
                  ? "text-muted"
                  : "text-amber-200"
              }`}
            >
              {visit.scopeReadState === "available"
                ? `Scope · ${visit.scopeItems.length} Jobber item${visit.scopeItems.length === 1 ? "" : "s"}`
                : visit.scopeReadState === "partial"
                  ? `Scope · ${visit.scopeItems.length}+ items; verify the rest in Jobber`
                  : "Service scope visibility unavailable"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <span className="rounded-full border border-border px-3 py-1 text-[11px] text-muted">
              {humanizeStatus(visit.visitStatus) ?? "Visit"}
            </span>
            {visit.jobStatus ? (
              <span className="rounded-full border border-border px-3 py-1 text-[11px] text-muted">
                {humanizeStatus(visit.jobStatus)}
              </span>
            ) : null}
          </div>
        </div>

        {fieldEventStatusAvailable && appointmentId ? (
          <div className="mt-5 rounded-2xl border border-accent/25 bg-accent/[0.055] p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.17em] text-accent">
                  Live field status
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {technicianVisitStageLabel(visit.homeAtlasFieldStage)}
                </p>
              </div>
              <span className="rounded-full border border-accent/25 px-3 py-1 text-xs tabular-nums text-accent">
                {fieldStageProgress.completed}/{fieldStageProgress.total}
              </span>
            </div>
            <div
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-foreground/10"
              role="progressbar"
              aria-label="Technician service progress"
              aria-valuemin={0}
              aria-valuemax={fieldStageProgress.total}
              aria-valuenow={fieldStageProgress.completed}
            >
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-500"
                style={{
                  width: `${(fieldStageProgress.completed / fieldStageProgress.total) * 100}%`,
                }}
              />
            </div>
            {visit.homeAtlasFieldStageAt ? (
              <p className="mt-2 text-[11px] text-muted">
                Updated {formatTime(visit.homeAtlasFieldStageAt, timezone)}
                {visit.homeAtlasFieldStageBy
                  ? ` by ${visit.homeAtlasFieldStageBy}`
                  : ""}
              </p>
            ) : (
              <p className="mt-2 text-[11px] text-muted">
                The assigned technician has not started this stop in Field Run.
              </p>
            )}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 border-t border-border/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted">
            {formatTimeRange(visit, timezone)} Pacific
          </p>
          <div className="flex flex-wrap gap-2">
            {visit.homeAtlasPortalPath ? (
              <Link
                href={visit.homeAtlasPortalPath}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/[0.08] px-4 text-xs text-emerald-200 transition hover:bg-emerald-400/[0.13]"
              >
                Verify customer portal
              </Link>
            ) : null}
            {visit.jobberClientWebUri ? (
              <a
                href={visit.jobberClientWebUri}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-border px-4 text-xs text-muted transition hover:border-foreground/30 hover:text-foreground"
              >
                Customer in Jobber
              </a>
            ) : null}
            {visit.jobberPropertyWebUri ? (
              <a
                href={visit.jobberPropertyWebUri}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-accent/35 bg-accent/[0.06] px-4 text-xs text-accent transition hover:bg-accent/10"
              >
                Property in Jobber
              </a>
            ) : null}
          </div>
        </div>

        <div className="mt-4 border-t border-border/60 pt-4">
          {needsFieldCloseout ? (
            <div className="mb-3 rounded-xl border border-amber-400/30 bg-amber-400/[0.08] px-4 py-3">
              <p className="text-xs font-medium text-amber-100">
                HomeAtlas closeout needed
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-amber-100/65">
                Jobber marks this complete, but no visit note or photo record is
                attached yet. Finish the action below so the home history stays
                trustworthy.
              </p>
            </div>
          ) : null}
          {needsCustomerPortalUpdate ? (
            <div className="mb-3 rounded-xl border border-sky-300/25 bg-sky-300/[0.07] px-4 py-3">
              <p className="text-xs font-medium text-sky-100">
                Customer portal update needed
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-sky-100/65">
                HomeAtlas has an internal visit record, but every saved note and
                photo is private. Add a customer update or portal-visible photo to
                complete the homeowner experience.
              </p>
            </div>
          ) : null}
          {propertyId && appointmentId ? (
            <>
              {visit.homeAtlasFieldRecordCount > 0 ? (
                <div className="mb-3 flex flex-col justify-between gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.07] px-4 py-3 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-xs font-medium text-emerald-200">
                      HomeAtlas visit memory saved
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-emerald-100/65">
                      {visit.homeAtlasFieldRecordCount} field record
                      {visit.homeAtlasFieldRecordCount === 1 ? "" : "s"}
                      {visit.homeAtlasLatestFieldRecordBy
                        ? ` · latest by ${visit.homeAtlasLatestFieldRecordBy}`
                        : ""}
                    </p>
                    <p className="mt-1 text-[10px] text-emerald-100/55">
                      {visit.homeAtlasCustomerVisibleRecordCount > 0
                        ? "Customer portal updated"
                        : "Internal record only"}
                    </p>
                  </div>
                  {visit.homeAtlasLatestFieldRecordAt ? (
                    <span className="text-[10px] text-emerald-100/55">
                      {formatSyncTime(
                        visit.homeAtlasLatestFieldRecordAt,
                        timezone,
                      )}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {visit.homeAtlasOpenFollowUpCount > 0 ? (
                <div className="mb-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-4 py-3">
                  <p className="text-xs font-medium text-amber-100">
                    Visit exception still open
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-amber-100/65">
                    {visit.homeAtlasOpenFollowUpCount} field follow-up
                    {visit.homeAtlasOpenFollowUpCount === 1 ? " is" : "s are"}
                    waiting in the owner action queue.
                  </p>
                </div>
              ) : null}
              <button
                type="button"
                aria-expanded={fieldCaptureOpen}
                onClick={() => setFieldCaptureOpen((open) => !open)}
                className="flex min-h-12 w-full items-center justify-between rounded-xl border border-accent/35 bg-accent/[0.07] px-4 text-left text-sm text-accent transition active:scale-[0.995]"
              >
                <span className="flex min-w-0 flex-col">
                  <span>{fieldActionLabel}</span>
                  {hasFieldDraft && !fieldCaptureOpen ? (
                    <span className="mt-0.5 text-[10px] text-accent/70">
                      Saved on this device · expires after 72 hours without use
                    </span>
                  ) : null}
                </span>
                <span aria-hidden>{fieldCaptureOpen ? "−" : "+"}</span>
              </button>
              {fieldCaptureOpen ? (
                <div className="mt-4 rounded-2xl border border-border bg-foreground/[0.025] p-4 sm:p-5">
                  <VisitFieldCapture
                    propertyId={propertyId}
                    appointmentId={appointmentId}
                    clientName={visit.clientName}
                    serviceLabel={service}
                    scopeItems={visit.scopeItems}
                    scopeReadState={visit.scopeReadState}
                    onSaved={onFieldRecordSaved}
                    onDraftStateChange={setHasFieldDraft}
                  />
                </div>
              ) : null}
            </>
          ) : propertyId ? (
            <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.06] p-4 text-xs leading-relaxed text-amber-100">
              This property is paired, but the HomeAtlas appointment is still
              reconciling. Sync Jobber, then refresh Today to attach photos safely.
            </div>
          ) : (
            <div className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-foreground/[0.025] p-4 sm:flex-row sm:items-center">
              <p className="text-xs leading-relaxed text-muted">
                Pair this Jobber property to a HomeAtlas member before adding portal photos.
              </p>
              <Link
                href="/hq/jobber"
                className="shrink-0 text-xs text-accent underline underline-offset-4"
              >
                Pair property
              </Link>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function MetricCard({
  label,
  value,
  detail,
  accent = false,
  warning = false,
}: {
  label: string;
  value: string | number;
  detail: string;
  accent?: boolean;
  warning?: boolean;
}) {
  const cardClassName = warning
    ? "border-amber-400/30 bg-amber-400/[0.08]"
    : accent
      ? "border-accent/25 bg-accent/[0.06]"
      : "border-border/70 bg-background/50";
  const valueClassName = warning
    ? "text-amber-100"
    : accent
      ? "text-accent"
      : "text-foreground";
  return (
    <div className={`rounded-2xl border p-4 ${cardClassName}`}>
      <p className="text-[9px] uppercase tracking-[0.17em] text-muted">{label}</p>
      <p className={`mt-2 text-2xl ${valueClassName}`}>
        {value}
      </p>
      <p className="mt-1 text-[11px] text-muted">{detail}</p>
    </div>
  );
}

async function requestTodayData(): Promise<JobberTodayData> {
  const response = await fetch("/api/admin/care-operations/jobber/today", {
    headers: getAdminRequestHeaders(),
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as
    | (JobberTodayData & { error?: string })
    | null;
  if (!response.ok || !body) {
    throw new Error(body?.error ?? "Could not load today's Jobber schedule");
  }
  return body;
}

function TodayWorkspaceContent() {
  const [data, setData] = useState<JobberTodayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [resolvingFollowUpId, setResolvingFollowUpId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await requestTodayData());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load today's Jobber schedule",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const initialLoad = async () => {
      try {
        const nextData = await requestTodayData();
        if (active) setData(nextData);
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load today's Jobber schedule",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void initialLoad();
    return () => {
      active = false;
    };
  }, []);

  const syncJobber = async () => {
    setSyncing(true);
    setError(null);
    try {
      const response = await fetch(
        "/api/admin/care-operations/jobber/sync",
        {
          method: "POST",
          headers: getAdminRequestHeaders(),
        },
      );
      const body = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Jobber synchronization did not finish");
      }
      await load();
    } catch (syncError) {
      setError(
        syncError instanceof Error
          ? syncError.message
          : "Jobber synchronization did not finish",
      );
    } finally {
      setSyncing(false);
    }
  };

  const resolveFollowUp = async (assessmentId: string) => {
    if (resolvingFollowUpId) return;
    setResolvingFollowUpId(assessmentId);
    setError(null);
    try {
      const response = await fetch("/api/admin/field-records/follow-ups", {
        method: "PATCH",
        headers: getAdminRequestHeaders(),
        body: JSON.stringify({
          assessmentId,
          resolvedBy: "HQ operator",
        }),
      });
      const body = (await response.json().catch(() => null)) as
        | { assessmentId?: string; error?: string }
        | null;
      if (!response.ok || !body?.assessmentId) {
        throw new Error(body?.error ?? "Could not complete the field follow-up.");
      }
      setData((current) =>
        current
          ? {
              ...current,
              fieldFollowUps: (current.fieldFollowUps ?? []).filter(
                (followUp) => followUp.assessmentId !== body.assessmentId,
              ),
            }
          : current,
      );
    } catch (resolveError) {
      setError(
        resolveError instanceof Error
          ? resolveError.message
          : "Could not complete the field follow-up.",
      );
    } finally {
      setResolvingFollowUpId(null);
    }
  };

  const now = data ? new Date(data.loadedAt) : new Date();
  const stale = data
    ? isJobberTodayDataStale(data.lastSyncedAt, now)
    : false;

  return (
    <AmbientStage className="min-h-screen px-4 py-8 text-foreground sm:px-6 sm:py-12">
      <div className="relative mx-auto max-w-6xl">
        <HqFounderNav />
        <MotionReveal className="mb-8 mt-10">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <p className={craftEyebrow}>Jobber scheduling truth</p>
              <h1 className={`${craftHeading} mt-3 text-4xl sm:text-5xl`}>
                Today
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
                The real Jobber route for today, in Pacific time. Completed jobs
                stay visible, and every customer opens back to the source record.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading || syncing}
                className="rounded-full border border-border px-5 py-3 text-sm text-muted transition hover:text-foreground disabled:opacity-50"
              >
                {loading && data ? "Refreshing..." : "Refresh view"}
              </button>
              <button
                type="button"
                onClick={() => void syncJobber()}
                disabled={loading || syncing || data?.connected === false}
                className="rounded-full border border-accent/40 bg-accent/10 px-5 py-3 text-sm text-accent transition hover:bg-accent/15 disabled:opacity-50"
              >
                {syncing ? "Syncing Jobber..." : "Sync Jobber now"}
              </button>
            </div>
          </div>
        </MotionReveal>

        {data ? (
          <section className="mb-8 overflow-hidden rounded-[2rem] border border-border/80 bg-background/65 p-5 backdrop-blur-xl sm:p-7">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-[10px] uppercase tracking-[0.19em] text-accent">
                  {formatCalendarDate(data.calendarDate)}
                </p>
                <p className="mt-2 text-sm text-foreground">
                  {data.accountName ?? "Jobber account"}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xs text-muted">
                  Last synced {formatSyncTime(data.lastSyncedAt, data.timezone)}
                </p>
                <p className="mt-1 text-[11px] text-muted">
                  {data.timezone.replace("_", " ")}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                label="Today's jobs"
                value={data.summary.total}
                detail="Scheduled in Jobber"
                accent
              />
              <MetricCard
                label="Remaining"
                value={data.summary.remaining}
                detail="Still on the route"
              />
              <MetricCard
                label="Complete"
                value={data.summary.complete}
                detail="Kept for the full-day view"
              />
              <MetricCard
                label="Crew assigned"
                value={data.summary.assigned}
                detail={
                  data.summary.assignmentUnknown > 0
                    ? `${data.summary.assignmentUnknown} stop${data.summary.assignmentUnknown === 1 ? "" : "s"} could not be verified`
                    : "Mirrored from Jobber"
                }
              />
              <MetricCard
                label="Unassigned"
                value={
                  data.summary.assignmentUnknown > 0
                    ? "—"
                    : data.summary.unassigned
                }
                detail={
                  data.summary.assignmentUnknown > 0
                    ? "Crew visibility incomplete"
                    : "Needs a Jobber crew assignment"
                }
                warning={
                  data.summary.assignmentUnknown > 0 ||
                  data.summary.unassigned > 0
                }
              />
              <MetricCard
                label="Records saved"
                value={
                  data.fieldRecordStatusAvailable
                    ? data.summary.documented
                    : "—"
                }
                detail={
                  data.fieldRecordStatusAvailable
                    ? "HomeAtlas visit record attached"
                    : "Field-record setup required"
                }
              />
              <MetricCard
                label="Portal updated"
                value={
                  data.fieldRecordStatusAvailable
                    ? data.summary.portalUpdated
                    : "—"
                }
                detail={
                  data.fieldRecordStatusAvailable
                    ? "Customer-visible note or photo"
                    : "Field-record setup required"
                }
              />
              <MetricCard
                label="Needs closeout"
                value={
                  data.fieldRecordStatusAvailable
                    ? data.summary.completedWithoutRecord
                    : "—"
                }
                detail={
                  data.fieldRecordStatusAvailable
                    ? "Complete without visit proof"
                    : "Not available until migration 054"
                }
                warning={
                  data.fieldRecordStatusAvailable &&
                  data.summary.completedWithoutRecord > 0
                }
              />
            </div>
          </section>
        ) : null}

        {data ? (
          <FieldFollowUpQueue
            followUps={data.fieldFollowUps ?? []}
            timezone={data.timezone}
            now={now}
            resolvingId={resolvingFollowUpId}
            onResolve={(assessmentId) => void resolveFollowUp(assessmentId)}
          />
        ) : null}

        {data && !data.connected ? (
          <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] p-4 text-sm text-amber-100">
            Jobber needs to be reconnected before this schedule can refresh. Existing
            synchronized visits are shown below. {" "}
            <a href="/hq/jobber" className="underline underline-offset-4">
              Open Jobber settings
            </a>
          </div>
        ) : null}

        {data && data.connected && stale ? (
          <div className="mb-6 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4 text-sm text-amber-100">
            This schedule is more than six hours old. Use Sync Jobber now before
            dispatching the route.
          </div>
        ) : null}

        {data && data.summary.assignmentUnknown > 0 ? (
          <div className="mb-6 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4 text-sm text-amber-100">
            HomeAtlas could not verify crew assignments for {data.summary.assignmentUnknown} visit
            {data.summary.assignmentUnknown === 1 ? "" : "s"}. Keep dispatching
            from Jobber until the app has Users read access and a fresh sync.
          </div>
        ) : data && data.summary.unassigned > 0 ? (
          <div className="mb-6 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4 text-sm text-amber-100">
            {data.summary.unassigned} visit
            {data.summary.unassigned === 1 ? " has" : "s have"} no technician
            assigned in Jobber. Assign the crew there; HomeAtlas will mirror it
            on the next sync.
          </div>
        ) : null}

        {data && !data.fieldRecordStatusAvailable ? (
          <div className="mb-6 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4 text-sm text-amber-100">
            Today can still show the Jobber route, but it cannot verify visit
            notes or photos until HomeAtlas migration 054 is live. No jobs are
            being labeled undocumented from incomplete data.
          </div>
        ) : null}

        {data && !data.fieldEventStatusAvailable ? (
          <div className="mb-6 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4 text-sm text-amber-100">
            Technician live status is waiting on migration 058. Jobber schedule
            and visit closeouts remain available while that automation is offline.
          </div>
        ) : null}

        {data &&
        data.fieldRecordStatusAvailable &&
        data.summary.completedWithoutRecord > 0 ? (
          <div className="mb-6 rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-400/[0.1] to-background/60 p-4 text-sm text-amber-100">
            <span className="font-medium">
              {data.summary.completedWithoutRecord} completed visit
              {data.summary.completedWithoutRecord === 1 ? "" : "s"} still need
              {data.summary.completedWithoutRecord === 1 ? "s" : ""} proof of
              service.
            </span>{" "}
            Open the highlighted job cards below and save the field record.
          </div>
        ) : null}

        {data &&
        data.fieldRecordStatusAvailable &&
        data.summary.completedWithPrivateOnlyRecord > 0 ? (
          <div className="mb-6 rounded-2xl border border-sky-300/25 bg-sky-300/[0.06] p-4 text-sm text-sky-100">
            <span className="font-medium">
              {data.summary.completedWithPrivateOnlyRecord} completed visit
              {data.summary.completedWithPrivateOnlyRecord === 1 ? " has" : "s have"}
              {" "}an internal record but no customer-visible portal update.
            </span>{" "}
            Use the blue-highlighted job cards to publish the homeowner summary.
          </div>
        ) : null}

        {error ? (
          <div className="mb-6 flex flex-col justify-between gap-3 rounded-2xl border border-red-500/25 bg-red-500/[0.06] p-4 text-sm text-red-300 sm:flex-row sm:items-center">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void load()}
              className="self-start underline underline-offset-4 sm:self-auto"
            >
              Try again
            </button>
          </div>
        ) : null}

        {loading && !data ? (
          <div className="rounded-[2rem] border border-border bg-background/60 p-10 text-center">
            <p className="font-serif text-2xl text-foreground">Reading Jobber...</p>
            <p className="mt-3 text-sm text-muted">
              Building today&apos;s Pacific-time route.
            </p>
          </div>
        ) : data?.visits.length === 0 ? (
          <div className="rounded-[2rem] border border-border bg-background/60 p-10 text-center">
            <p className="font-serif text-2xl text-foreground">
              No Jobber jobs scheduled today.
            </p>
            <p className="mt-3 text-sm text-muted">
              This is the current synchronized Jobber calendar for today.
            </p>
          </div>
        ) : data ? (
          <section className="space-y-4">
            <div className="flex items-end justify-between gap-4 px-1">
              <div>
                <p className={craftEyebrow}>Route order</p>
                <h2 className="mt-2 font-serif text-2xl font-light text-foreground">
                  {data.visits.length} scheduled visit
                  {data.visits.length === 1 ? "" : "s"}
                </h2>
              </div>
              <p className="hidden text-xs text-muted sm:block">
                Earliest to latest
              </p>
            </div>
            <div className="space-y-4">
              {data.visits.map((visit) => (
                <JobberVisitCard
                  key={visit.projectionId}
                  visit={visit}
                  timezone={data.timezone}
                  now={now}
                  fieldRecordStatusAvailable={data.fieldRecordStatusAvailable}
                  fieldEventStatusAvailable={data.fieldEventStatusAvailable}
                  onFieldRecordSaved={() => void load()}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </AmbientStage>
  );
}

export function TodayWorkspacePage() {
  const [unlocked, setUnlocked] = useAdminUnlockedState();
  if (!unlocked) return <AdminPinGate onUnlock={() => setUnlocked(true)} />;
  return <TodayWorkspaceContent />;
}
