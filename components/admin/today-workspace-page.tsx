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

function JobberVisitCard({
  visit,
  timezone,
  now,
}: {
  visit: JobberTodayVisit;
  timezone: string;
  now: Date;
}) {
  const [fieldCaptureOpen, setFieldCaptureOpen] = useState(false);
  const moment = classifyJobberTodayVisit(visit, now);
  const style = MOMENT_STYLES[moment];
  const service = visit.title?.trim() || "Scheduled Jobber visit";

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

        <div className="mt-6 flex flex-col gap-3 border-t border-border/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted">
            {formatTimeRange(visit, timezone)} Pacific
          </p>
          <div className="flex flex-wrap gap-2">
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
          {visit.homeAtlasPropertyId && visit.homeAtlasAppointmentId ? (
            <>
              <button
                type="button"
                aria-expanded={fieldCaptureOpen}
                onClick={() => setFieldCaptureOpen((open) => !open)}
                className="flex min-h-12 w-full items-center justify-between rounded-xl border border-accent/35 bg-accent/[0.07] px-4 text-left text-sm text-accent transition active:scale-[0.995]"
              >
                <span>
                  {fieldCaptureOpen ? "Close field record" : "Add photos + visit notes"}
                </span>
                <span aria-hidden>{fieldCaptureOpen ? "−" : "+"}</span>
              </button>
              {fieldCaptureOpen ? (
                <div className="mt-4 rounded-2xl border border-border bg-foreground/[0.025] p-4 sm:p-5">
                  <VisitFieldCapture
                    propertyId={visit.homeAtlasPropertyId}
                    appointmentId={visit.homeAtlasAppointmentId}
                    clientName={visit.clientName}
                    serviceLabel={service}
                  />
                </div>
              ) : null}
            </>
          ) : visit.homeAtlasPropertyId ? (
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
}: {
  label: string;
  value: string | number;
  detail: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        accent
          ? "border-accent/25 bg-accent/[0.06]"
          : "border-border/70 bg-background/50"
      }`}
    >
      <p className="text-[9px] uppercase tracking-[0.17em] text-muted">{label}</p>
      <p className={`mt-2 text-2xl ${accent ? "text-accent" : "text-foreground"}`}>
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

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
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
            </div>
          </section>
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
