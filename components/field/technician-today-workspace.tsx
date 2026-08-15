"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AmbientStage } from "@/components/craft/ambient-stage";
import {
  classifyJobberTodayVisit,
  isJobberTodayDataStale,
  type JobberTodayData,
  type JobberTodayVisit,
} from "@/lib/care-operations/jobber-today-types";
import { readVisitFieldDraft } from "@/lib/field-records/visit-field-draft";
import type { VisitFieldSaveResult } from "@/components/visit/visit-field-capture";
import {
  resolveTechnicianVisitNextAction,
  technicianVisitStageLabel,
  technicianVisitStageProgress,
  type TechnicianVisitEventType,
} from "@/lib/field-operations/technician-visit-events";
import {
  filterTechnicianVisits,
  listTechnicianCrew,
  resolveTechnicianVisitReadiness,
  selectTechnicianNextAction,
  summarizeTechnicianRun,
  TECHNICIAN_ALL_CREW,
  TECHNICIAN_UNASSIGNED_CREW,
  technicianCrewSelection,
  type TechnicianVisitReadiness,
} from "@/lib/field-operations/technician-run";

const VisitFieldCapture = dynamic(
  () =>
    import("@/components/visit/visit-field-capture").then(
      (module) => module.VisitFieldCapture,
    ),
  {
    ssr: false,
    loading: () => (
      <p className="py-8 text-center text-sm text-white/55">
        Opening field closeout…
      </p>
    ),
  },
);

const READINESS_STYLE: Record<
  TechnicianVisitReadiness,
  { label: string; detail: string; className: string }
> = {
  ready: {
    label: "Ready",
    detail: "Property memory and visit record are connected.",
    className: "border-emerald-300/35 bg-emerald-300/10 text-emerald-100",
  },
  complete: {
    label: "Closed out",
    detail: "Jobber is complete and the customer portal has an update.",
    className: "border-emerald-300/35 bg-emerald-300/10 text-emerald-100",
  },
  closeout_required: {
    label: "Closeout required",
    detail: "Jobber is complete, but HomeAtlas still needs a note or photo.",
    className: "border-amber-300/40 bg-amber-300/10 text-amber-100",
  },
  portal_update_required: {
    label: "Portal update needed",
    detail: "Internal memory exists; add something the customer can see.",
    className: "border-sky-300/35 bg-sky-300/10 text-sky-100",
  },
  follow_up_open: {
    label: "Exception open",
    detail: "The visit is documented, but its HQ follow-up is still open.",
    className: "border-amber-300/40 bg-amber-300/10 text-amber-100",
  },
  pairing_required: {
    label: "HQ pairing needed",
    detail: "This Jobber property is not paired to a HomeAtlas home yet.",
    className: "border-rose-300/35 bg-rose-300/10 text-rose-100",
  },
  appointment_syncing: {
    label: "Visit syncing",
    detail: "The home is paired; HQ needs the verified appointment link.",
    className: "border-amber-300/35 bg-amber-300/10 text-amber-100",
  },
  proof_unavailable: {
    label: "Proof check unavailable",
    detail: "Do not assume this visit is closed until HQ restores field proof.",
    className: "border-rose-300/35 bg-rose-300/10 text-rose-100",
  },
  jobber_completion_pending: {
    label: "Jobber close pending",
    detail:
      "Field Run is done, but Jobber still shows this visit open. HQ needs to close it there.",
    className: "border-amber-300/40 bg-amber-300/10 text-amber-100",
  },
};

const TIME_FORMATTERS = new Map<string, Intl.DateTimeFormat>();
const TECHNICIAN_CREW_STORAGE_KEY = "homeatlas.field-run.crew-v1";

function timeFormatter(timezone: string): Intl.DateTimeFormat {
  let formatter = TIME_FORMATTERS.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
    });
    TIME_FORMATTERS.set(timezone, formatter);
  }
  return formatter;
}

function formatTime(value: string, timezone: string): string {
  return timeFormatter(timezone).format(new Date(value));
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(`${value}T12:00:00Z`));
}

function formatSyncedAt(value: string | null, timezone: string): string {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function serviceLabel(visit: JobberTodayVisit): string {
  return visit.title?.trim() || "Scheduled Jobber service";
}

async function requestTodayData(): Promise<JobberTodayData> {
  const response = await fetch("/api/field/today", {
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as
    | (JobberTodayData & { error?: string })
    | null;
  if (!response.ok || !body) {
    throw new Error(body?.error ?? "Could not load the field run.");
  }
  return body;
}

function RunMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "good" | "warning";
}) {
  const toneClass =
    tone === "good"
      ? "border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-100"
      : tone === "warning"
        ? "border-amber-300/30 bg-amber-300/[0.08] text-amber-100"
        : "border-white/10 bg-white/[0.04] text-white";
  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClass}`}>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.16em] opacity-65">
        {label}
      </p>
    </div>
  );
}

function TechnicianVisitCard({
  visit,
  timezone,
  fieldRecordStatusAvailable,
  fieldEventStatusAvailable,
  fieldActorName,
  onSaved,
}: {
  visit: JobberTodayVisit;
  timezone: string;
  fieldRecordStatusAvailable: boolean;
  fieldEventStatusAvailable: boolean;
  fieldActorName: string | null;
  onSaved: () => void;
}) {
  const [captureOpen, setCaptureOpen] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [routePending, setRoutePending] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeNotice, setRouteNotice] = useState<string | null>(null);
  const readiness = resolveTechnicianVisitReadiness(
    visit,
    fieldRecordStatusAvailable,
  );
  const readinessStyle = READINESS_STYLE[readiness];
  const propertyId = visit.homeAtlasPropertyId;
  const appointmentId = visit.homeAtlasAppointmentId;
  const canCapture = Boolean(
    fieldRecordStatusAvailable && propertyId && appointmentId,
  );
  const canAdvanceRoute = Boolean(
    fieldEventStatusAvailable && propertyId && appointmentId,
  );
  const stageProgress = technicianVisitStageProgress(
    visit.homeAtlasFieldStage,
  );
  const routeAction = canAdvanceRoute
    ? resolveTechnicianVisitNextAction({
        stage: visit.homeAtlasFieldStage,
        hasFieldRecord: visit.homeAtlasFieldRecordCount > 0,
        jobberComplete: visit.isComplete,
      })
    : null;
  const showStandaloneCaptureButton =
    !fieldEventStatusAvailable ||
    (hasDraft && routeAction?.kind !== "closeout") ||
    visit.homeAtlasFieldStage === "service_completed" ||
    visit.homeAtlasFieldStage === "departed";
  const moment = classifyJobberTodayVisit(visit);
  const actionLabel = hasDraft
    ? "Resume saved closeout"
    : readiness === "closeout_required"
      ? "Finish closeout"
      : readiness === "portal_update_required"
        ? "Add customer update"
        : readiness === "follow_up_open"
          ? "Update service exception"
        : visit.homeAtlasFieldRecordCount > 0
          ? "Add visit memory"
          : "Document this visit";

  useEffect(() => {
    if (!propertyId || !appointmentId) return;
    const timer = window.setTimeout(() => {
      setHasDraft(
        Boolean(
          readVisitFieldDraft(window.localStorage, {
            propertyId,
            appointmentId,
          }),
        ),
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [appointmentId, propertyId]);

  async function advanceRoute(eventType: TechnicianVisitEventType) {
    if (!propertyId || !appointmentId || routePending) return;
    setRoutePending(true);
    setRouteError(null);
    setRouteNotice(null);
    try {
      const response = await fetch("/api/field/visit-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: crypto.randomUUID(),
          propertyId,
          appointmentId,
          eventType,
        }),
      });
      const body = (await response.json().catch(() => null)) as
        | {
            customerAlertPrepared?: boolean;
            error?: string;
          }
        | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Could not advance the field route.");
      }
      setRouteNotice(
        body?.customerAlertPrepared
          ? "Status saved. A customer update is prepared, not sent."
          : "Status saved to the HomeAtlas service timeline.",
      );
      onSaved();
    } catch (routeActionError) {
      setRouteError(
        routeActionError instanceof Error
          ? routeActionError.message
          : "Could not advance the field route.",
      );
    } finally {
      setRoutePending(false);
    }
  }

  function handleCloseoutSaved(result: VisitFieldSaveResult) {
    setCaptureOpen(false);
    setRouteError(null);
    setRouteNotice(
      result.routeEventRecorded === false
        ? (result.routeEventWarning ??
            "Closeout saved. Refresh and retry the route status.")
        : result.routeEventRecorded
          ? "Closeout saved. Service advanced to complete."
          : "Closeout saved to the property record.",
    );
    onSaved();
  }

  return (
    <article
      id={`visit-${visit.projectionId}`}
      className="scroll-mt-5 overflow-hidden rounded-[1.65rem] border border-white/10 bg-[#111615] shadow-[0_22px_65px_rgba(0,0,0,0.32)]"
    >
      <div className="border-b border-white/10 bg-white/[0.025] px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-2xl font-semibold tabular-nums text-white">
              {formatTime(visit.scheduledStart, timezone)}
            </p>
            <p className="mt-1 text-xs text-white/45">
              {visit.scheduledEnd
                ? `Until ${formatTime(visit.scheduledEnd, timezone)}`
                : "Scheduled start"}
            </p>
          </div>
          <span
            className={`rounded-full border px-3 py-1.5 text-[11px] font-medium ${readinessStyle.className}`}
          >
            {readinessStyle.label}
          </span>
        </div>
      </div>

      <div className="p-5">
        <p className="text-[10px] uppercase tracking-[0.18em] text-[#9be2bd]">
          {visit.jobNumber ? `Job #${visit.jobNumber}` : "Jobber visit"}
          {moment === "in_progress" ? " · happening now" : ""}
          {moment === "late" ? " · past scheduled time" : ""}
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-white">
          {visit.clientName}
        </h2>
        <p className="mt-2 text-base leading-relaxed text-white/70">
          {serviceLabel(visit)}
        </p>
        {visit.propertyLabel ? (
          <p className="mt-1 text-sm text-white/45">{visit.propertyLabel}</p>
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-xs">
          <span className="uppercase tracking-[0.15em] text-white/35">Crew</span>
          <span
            className={
              visit.assignmentReadState !== "available" ||
              visit.assignedUsers.length === 0
                ? "text-amber-100"
                : "text-white/75"
            }
          >
            {visit.assignmentReadState !== "available"
              ? "Visibility unavailable"
              : visit.assignedUsers.length > 0
                ? visit.assignedUsers.map((user) => user.name).join(", ")
                : "Unassigned in Jobber"}
          </span>
        </div>

        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] uppercase tracking-[0.15em] text-white/35">
              Service scope
            </span>
            <span
              className={`text-xs ${
                visit.scopeReadState === "available"
                  ? "text-white/70"
                  : "text-amber-100"
              }`}
            >
              {visit.scopeReadState === "available"
                ? `${visit.scopeItems.length} Jobber item${visit.scopeItems.length === 1 ? "" : "s"}`
                : visit.scopeReadState === "partial"
                  ? `${visit.scopeItems.length}+ Jobber items`
                  : "Verify in Jobber"}
            </span>
          </div>
          {visit.scopeItems.length > 0 ? (
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-white/50">
              {visit.scopeItems
                .map((item) =>
                  item.quantity > 1
                    ? `${item.name} × ${item.quantity}`
                    : item.name,
                )
                .join(" · ")}
            </p>
          ) : null}
        </div>

        <div className={`mt-5 rounded-xl border px-4 py-3 ${readinessStyle.className}`}>
          <p className="text-sm font-medium">{readinessStyle.label}</p>
          <p className="mt-1 text-xs leading-relaxed opacity-70">
            {readinessStyle.detail}
          </p>
        </div>

        {fieldEventStatusAvailable && propertyId && appointmentId ? (
          <section className="mt-3 rounded-2xl border border-[#9be2bd]/25 bg-[#9be2bd]/[0.055] p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.17em] text-[#9be2bd]">
                  Automated service flow
                </p>
                <p className="mt-1 text-sm font-medium text-[#d5f8e4]">
                  {technicianVisitStageLabel(visit.homeAtlasFieldStage)}
                </p>
              </div>
              <span className="rounded-full border border-[#9be2bd]/25 px-3 py-1 text-xs tabular-nums text-[#bff1d5]">
                {stageProgress.completed}/{stageProgress.total}
              </span>
            </div>
            <div
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"
              role="progressbar"
              aria-label="Service flow progress"
              aria-valuemin={0}
              aria-valuemax={stageProgress.total}
              aria-valuenow={stageProgress.completed}
            >
              <div
                className="h-full rounded-full bg-[#9be2bd] transition-[width] duration-500"
                style={{
                  width: `${(stageProgress.completed / stageProgress.total) * 100}%`,
                }}
              />
            </div>
            {visit.homeAtlasFieldStageAt ? (
              <p className="mt-2 text-[11px] text-white/45">
                Last moved {formatTime(visit.homeAtlasFieldStageAt, timezone)}
                {visit.homeAtlasFieldStageBy
                  ? ` by ${visit.homeAtlasFieldStageBy}`
                  : ""}
              </p>
            ) : null}

            {routeAction ? (
              <button
                type="button"
                disabled={
                  routePending ||
                  (routeAction.kind === "closeout" && !canCapture)
                }
                onClick={() => {
                  if (routeAction.kind === "closeout") {
                    setCaptureOpen((open) => !open);
                    return;
                  }
                  void advanceRoute(routeAction.eventType);
                }}
                className="mt-4 flex min-h-14 w-full items-center justify-between rounded-xl border border-[#9be2bd]/40 bg-[#9be2bd]/[0.12] px-4 text-left text-base font-medium text-[#d5f8e4] active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>
                  {routePending
                    ? "Saving status…"
                    : routeAction.kind === "closeout" && captureOpen
                      ? "Close field form"
                      : routeAction.label}
                  <span className="mt-0.5 block text-[10px] font-normal leading-relaxed text-[#bff1d5]/60">
                    {routeAction.detail}
                  </span>
                </span>
                <span aria-hidden>→</span>
              </button>
            ) : (
              <div className="mt-4 rounded-xl border border-emerald-300/25 bg-emerald-300/[0.08] px-4 py-3 text-sm text-emerald-100">
                Stop complete. The next assigned home is ready above.
              </div>
            )}

            <p className="mt-3 text-[10px] leading-relaxed text-white/40">
              Customer alert copy is prepared for approved moments. Nothing is
              sent until messaging approval and consent checks are live.
            </p>
          </section>
        ) : propertyId && appointmentId ? (
          <div className="mt-3 rounded-xl border border-amber-300/25 bg-amber-300/[0.07] px-4 py-3 text-xs leading-relaxed text-amber-100">
            Automated route status is waiting on migration 058. Visit closeouts
            still save normally.
          </div>
        ) : null}

        {routeNotice ? (
          <p
            role="status"
            className="mt-3 rounded-xl border border-sky-300/25 bg-sky-300/[0.07] px-4 py-3 text-xs leading-relaxed text-sky-100"
          >
            {routeNotice}
          </p>
        ) : null}
        {routeError ? (
          <p
            role="alert"
            className="mt-3 rounded-xl border border-rose-300/25 bg-rose-300/[0.07] px-4 py-3 text-xs leading-relaxed text-rose-100"
          >
            {routeError}
          </p>
        ) : null}

        {visit.homeAtlasFieldRecordCount > 0 ? (
          <div className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.05] px-4 py-3 text-xs text-emerald-100/75">
            {visit.homeAtlasFieldRecordCount} saved field record
            {visit.homeAtlasFieldRecordCount === 1 ? "" : "s"}
            {visit.homeAtlasLatestFieldRecordBy
              ? ` · latest by ${visit.homeAtlasLatestFieldRecordBy}`
              : ""}
          </div>
        ) : null}

        {visit.homeAtlasOpenFollowUpCount > 0 ? (
          <div className="mt-3 rounded-xl border border-amber-300/25 bg-amber-300/[0.07] px-4 py-3 text-xs text-amber-100/80">
            {visit.homeAtlasOpenFollowUpCount} visit exception
            {visit.homeAtlasOpenFollowUpCount === 1 ? " is" : "s are"} still
            open for HQ.
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-2">
          {propertyId ? (
            <Link
              href={`/tech/properties/${propertyId}`}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 bg-white/[0.035] px-3 text-center text-sm text-white/80 active:scale-[0.99]"
            >
              Property memory
            </Link>
          ) : fieldActorName ? (
            <span className="inline-flex min-h-12 items-center justify-center rounded-xl border border-amber-300/25 bg-amber-300/[0.06] px-3 text-center text-sm text-amber-100">
              HQ pairing needed
            </span>
          ) : (
            <Link
              href="/hq/jobber"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-amber-300/25 bg-amber-300/[0.06] px-3 text-center text-sm text-amber-100 active:scale-[0.99]"
            >
              Ask HQ to pair
            </Link>
          )}
          {visit.jobberPropertyWebUri ? (
            <a
              href={visit.jobberPropertyWebUri}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#9be2bd]/25 bg-[#9be2bd]/[0.06] px-3 text-center text-sm text-[#bff1d5] active:scale-[0.99]"
            >
              Open in Jobber
            </a>
          ) : (
            <span className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 px-3 text-center text-sm text-white/35">
              Jobber link missing
            </span>
          )}
        </div>

        {canCapture && propertyId && appointmentId ? (
          <div className="mt-3">
            {showStandaloneCaptureButton ? (
              <button
                type="button"
                aria-expanded={captureOpen}
                onClick={() => setCaptureOpen((open) => !open)}
                className="flex min-h-14 w-full items-center justify-between rounded-xl border border-[#9be2bd]/35 bg-[#9be2bd]/[0.09] px-4 text-left text-base font-medium text-[#c9f3dc] active:scale-[0.995]"
              >
                <span>
                  {captureOpen ? "Close field form" : actionLabel}
                  {hasDraft && !captureOpen ? (
                    <span className="mt-0.5 block text-[10px] font-normal text-[#bff1d5]/55">
                      Saved on this device
                    </span>
                  ) : null}
                </span>
                <span aria-hidden>{captureOpen ? "−" : "+"}</span>
              </button>
            ) : null}
            {captureOpen ? (
              <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                <VisitFieldCapture
                  propertyId={propertyId}
                  appointmentId={appointmentId}
                  clientName={visit.clientName}
                  serviceLabel={serviceLabel(visit)}
                  scopeItems={visit.scopeItems}
                  scopeReadState={visit.scopeReadState}
                  apiRoutePrefix="/api/field"
                  lockedTechnicianName={fieldActorName ?? undefined}
                  onSaved={handleCloseoutSaved}
                  onDraftStateChange={setHasDraft}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function TechnicianTodayWorkspace({
  actorKind,
  actorDisplayName,
}: {
  actorKind: "admin" | "technician";
  actorDisplayName: string;
}) {
  const technicianSession = actorKind === "technician";
  const [data, setData] = useState<JobberTodayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [crewSelection, setCrewSelection] = useState(TECHNICIAN_ALL_CREW);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await requestTodayData());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load the field run.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const initialLoad = async () => {
      try {
        const result = await requestTodayData();
        if (active) setData(result);
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load the field run.",
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

  useEffect(() => {
    if (technicianSession) return;
    const timer = window.setTimeout(() => {
      const storedSelection = window.localStorage.getItem(
        TECHNICIAN_CREW_STORAGE_KEY,
      );
      if (storedSelection) setCrewSelection(storedSelection);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [technicianSession]);

  const crew = useMemo(
    () => (data && !technicianSession ? listTechnicianCrew(data.visits) : []),
    [data, technicianSession],
  );
  const activeCrewSelection = useMemo(() => {
    if (
      crewSelection === TECHNICIAN_ALL_CREW ||
      (crewSelection === TECHNICIAN_UNASSIGNED_CREW &&
        (data?.summary.unassigned ?? 0) > 0) ||
      crew.some(
        (member) => technicianCrewSelection(member.id) === crewSelection,
      )
    ) {
      return crewSelection;
    }
    return TECHNICIAN_ALL_CREW;
  }, [crew, crewSelection, data?.summary.unassigned]);
  const filteredVisits = useMemo(
    () =>
      data
        ? filterTechnicianVisits(data.visits, activeCrewSelection)
        : [],
    [activeCrewSelection, data],
  );

  const summary = useMemo(
    () =>
      data
        ? summarizeTechnicianRun(
            filteredVisits,
            data.fieldRecordStatusAvailable,
          )
        : null,
    [data, filteredVisits],
  );
  const nextAction = useMemo(
    () =>
      data
        ? selectTechnicianNextAction(
            filteredVisits,
            data.fieldRecordStatusAvailable,
          )
        : null,
    [data, filteredVisits],
  );
  const stale = data
    ? isJobberTodayDataStale(data.lastSyncedAt, new Date(data.loadedAt))
    : false;
  const selectCrew = useCallback((selection: string) => {
    setCrewSelection(selection);
    window.localStorage.setItem(TECHNICIAN_CREW_STORAGE_KEY, selection);
  }, []);

  return (
    <AmbientStage className="min-h-[100svh] bg-[#080b0a] px-4 py-6 text-white sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <nav className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="text-[10px] uppercase tracking-[0.22em] text-white/45"
          >
            HomeAtlas · Field
          </Link>
          <div className="flex gap-2">
            <Link
              href="/tech/properties"
              className="inline-flex min-h-11 items-center rounded-full border border-white/10 px-4 text-xs text-white/65"
            >
              {technicianSession ? "My homes" : "All homes"}
            </Link>
            {technicianSession ? (
              <form action="/api/field/access/logout" method="post">
                <button
                  type="submit"
                  className="inline-flex min-h-11 items-center rounded-full border border-white/10 px-4 text-xs text-white/65"
                >
                  Sign out
                </button>
              </form>
            ) : (
              <Link
                href="/hq/today"
                className="inline-flex min-h-11 items-center rounded-full border border-white/10 px-4 text-xs text-white/65"
              >
                HQ view
              </Link>
            )}
          </div>
        </nav>

        <header className="pb-7 pt-10">
          <p className="text-[10px] uppercase tracking-[0.24em] text-[#9be2bd]">
            Technician command
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
            Field Run
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/55">
            The real Jobber route, property memory, and required customer proof
            in one phone-first workspace.
          </p>
          {technicianSession ? (
            <p className="mt-4 inline-flex min-h-10 items-center rounded-full border border-[#9be2bd]/25 bg-[#9be2bd]/[0.07] px-4 text-xs text-[#c9f3dc]">
              Field Pass · {actorDisplayName}
            </p>
          ) : null}
        </header>

        {error ? (
          <div className="mb-5 rounded-2xl border border-rose-300/30 bg-rose-300/[0.08] px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {data && summary ? (
          <>
            <section className="rounded-[1.75rem] border border-white/10 bg-[#111615]/90 p-5 shadow-[0_20px_65px_rgba(0,0,0,0.3)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-white">
                    {formatDate(data.calendarDate)}
                  </p>
                  <p className="mt-1 text-xs text-white/45">
                    {data.accountName ?? "Jobber account"} · synced {" "}
                    {formatSyncedAt(data.lastSyncedAt, data.timezone)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void load()}
                  disabled={loading}
                  className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-4 text-xs text-white/70 disabled:opacity-50"
                >
                  {loading ? "Refreshing…" : "Refresh"}
                </button>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <RunMetric label="Total stops" value={summary.total} />
                <RunMetric label="Ready" value={summary.ready} />
                <RunMetric label="Closed" value={summary.complete} tone="good" />
                <RunMetric
                  label="Needs action"
                  value={summary.actionRequired}
                  tone={summary.actionRequired > 0 ? "warning" : "good"}
                />
              </div>

              {!technicianSession &&
              (crew.length > 0 || data.summary.unassigned > 0) ? (
                <div className="mt-5 border-t border-white/10 pt-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                      Route lens
                    </p>
                    <p className="text-[10px] text-white/35">
                      Saved on this phone
                    </p>
                  </div>
                  <div
                    className="mt-3 flex snap-x gap-2 overflow-x-auto pb-1"
                    aria-label="Choose a technician route"
                  >
                    <button
                      type="button"
                      aria-pressed={activeCrewSelection === TECHNICIAN_ALL_CREW}
                      onClick={() => selectCrew(TECHNICIAN_ALL_CREW)}
                      className={`min-h-12 shrink-0 snap-start rounded-full border px-4 text-sm active:scale-[0.99] ${
                        activeCrewSelection === TECHNICIAN_ALL_CREW
                          ? "border-[#9be2bd]/45 bg-[#9be2bd]/[0.12] text-[#d5f8e4]"
                          : "border-white/10 bg-white/[0.025] text-white/60"
                      }`}
                    >
                      All · {data.visits.length}
                    </button>
                    {crew.map((member) => {
                      const selection = technicianCrewSelection(member.id);
                      return (
                        <button
                          key={member.id}
                          type="button"
                          aria-pressed={activeCrewSelection === selection}
                          onClick={() => selectCrew(selection)}
                          className={`min-h-12 shrink-0 snap-start rounded-full border px-4 text-sm active:scale-[0.99] ${
                            activeCrewSelection === selection
                              ? "border-[#9be2bd]/45 bg-[#9be2bd]/[0.12] text-[#d5f8e4]"
                              : "border-white/10 bg-white/[0.025] text-white/60"
                          }`}
                        >
                          {member.name} · {member.stopCount}
                        </button>
                      );
                    })}
                    {data.summary.unassigned > 0 ? (
                      <button
                        type="button"
                        aria-pressed={
                          activeCrewSelection === TECHNICIAN_UNASSIGNED_CREW
                        }
                        onClick={() => selectCrew(TECHNICIAN_UNASSIGNED_CREW)}
                        className={`min-h-12 shrink-0 snap-start rounded-full border px-4 text-sm active:scale-[0.99] ${
                          activeCrewSelection === TECHNICIAN_UNASSIGNED_CREW
                            ? "border-amber-300/45 bg-amber-300/[0.12] text-amber-100"
                            : "border-amber-300/20 bg-amber-300/[0.05] text-amber-100/70"
                        }`}
                      >
                        Unassigned · {data.summary.unassigned}
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </section>

            {stale ? (
              <div className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-300/[0.08] px-4 py-3 text-sm leading-relaxed text-amber-100">
                Jobber data is stale. Refresh this view; if the time does not
                change, ask HQ to run a Jobber sync before trusting the route.
              </div>
            ) : null}

            {data.summary.assignmentUnknown > 0 ? (
              <div className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-300/[0.08] px-4 py-3 text-sm leading-relaxed text-amber-100">
                Crew assignments could not be verified for {data.summary.assignmentUnknown} stop
                {data.summary.assignmentUnknown === 1 ? "" : "s"}. HQ needs
                Jobber Users read access before technicians should rely on
                personal route filtering.
              </div>
            ) : data.summary.unassigned > 0 ? (
              <div className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-300/[0.08] px-4 py-3 text-sm leading-relaxed text-amber-100">
                {data.summary.unassigned} stop
                {data.summary.unassigned === 1 ? " is" : "s are"} unassigned in
                Jobber. It stays visible here so work cannot disappear between
                crews.
              </div>
            ) : null}

            {nextAction ? (
              <a
                href={`#visit-${nextAction.projectionId}`}
                className="mt-4 flex min-h-16 items-center justify-between gap-4 rounded-2xl border border-[#9be2bd]/30 bg-[#9be2bd]/[0.09] px-5 text-left text-[#d5f8e4] active:scale-[0.995]"
              >
                <span>
                  <span className="block text-[10px] uppercase tracking-[0.18em] text-[#9be2bd]/70">
                    Next action
                  </span>
                  <span className="mt-1 block text-base font-medium">
                    {nextAction.clientName} · {" "}
                    {formatTime(nextAction.scheduledStart, data.timezone)}
                  </span>
                </span>
                <span aria-hidden>↓</span>
              </a>
            ) : null}

            <section className="mt-8 space-y-4" aria-label="Today's field route">
              {filteredVisits.length > 0 ? (
                filteredVisits.map((visit) => (
                  <TechnicianVisitCard
                    key={visit.projectionId}
                    visit={visit}
                    timezone={data.timezone}
                    fieldRecordStatusAvailable={
                      data.fieldRecordStatusAvailable
                    }
                    fieldEventStatusAvailable={
                      data.fieldEventStatusAvailable
                    }
                    fieldActorName={
                      technicianSession ? actorDisplayName : null
                    }
                    onSaved={() => void load()}
                  />
                ))
              ) : (
                <div className="rounded-[1.75rem] border border-white/10 bg-[#111615] px-6 py-12 text-center">
                  <p className="text-lg text-white">No Jobber stops today.</p>
                  <p className="mt-2 text-sm text-white/45">
                    {data.visits.length > 0
                      ? "No stops match this crew lens. Choose All to see the full route."
                      : technicianSession
                        ? "No Jobber stops are assigned to this Field Pass today."
                        : "The route is clear. Check All homes for property memory."}
                  </p>
                </div>
              )}
            </section>
          </>
        ) : loading ? (
          <div className="rounded-[1.75rem] border border-white/10 bg-[#111615] px-6 py-16 text-center text-sm text-white/50">
            Building today&apos;s field run…
          </div>
        ) : null}
      </div>
    </AmbientStage>
  );
}
