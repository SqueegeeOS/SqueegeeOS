"use client";

import Link from "next/link";
import {
  technicianVisitStageLabel,
  technicianVisitStageProgress,
} from "@/lib/field-operations/technician-visit-events";
import { technicianFieldPassAnchorId } from "@/lib/care-operations/jobber-today-links";
import type {
  TechnicianDispatchBoard as TechnicianDispatchBoardView,
  TechnicianDispatchCrewMember,
  TechnicianDispatchState,
  TechnicianFieldPassState,
} from "@/lib/field-operations/technician-dispatch";

const DISPATCH_STATE_COPY: Record<
  TechnicianDispatchState,
  { label: string; className: string }
> = {
  attention: {
    label: "Needs attention",
    className: "border-amber-300/30 bg-amber-300/[0.09] text-amber-100",
  },
  working: {
    label: "Working",
    className: "border-accent/35 bg-accent/[0.09] text-accent",
  },
  ready: {
    label: "Ready",
    className: "border-sky-300/30 bg-sky-300/[0.08] text-sky-100",
  },
  done: {
    label: "Route closed",
    className: "border-emerald-300/30 bg-emerald-300/[0.08] text-emerald-100",
  },
  off_route: {
    label: "Off route",
    className: "border-white/10 bg-white/[0.035] text-white/45",
  },
};

const PASS_STATE_COPY: Record<
  TechnicianFieldPassState,
  { label: string; className: string }
> = {
  active: {
    label: "Technician active",
    className: "border-emerald-300/25 text-emerald-100",
  },
  expiring: {
    label: "Access needs refresh",
    className: "border-amber-300/25 text-amber-100",
  },
  pending: {
    label: "Install pending",
    className: "border-sky-300/25 text-sky-100",
  },
  expired: {
    label: "Access expired",
    className: "border-red-300/25 text-red-100",
  },
  revoked: {
    label: "Access removed",
    className: "border-red-300/25 text-red-100",
  },
  missing: {
    label: "No Technician Access",
    className: "border-white/10 text-white/45",
  },
};

const TIME_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

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

function formatTimeRange(
  start: string,
  end: string | null,
  timezone: string,
): string {
  const startLabel = formatTime(start, timezone);
  return end ? `${startLabel}–${formatTime(end, timezone)}` : startLabel;
}

function DispatchMetric({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: number;
  warning?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${
        warning
          ? "border-amber-300/25 bg-amber-300/[0.07]"
          : "border-white/10 bg-white/[0.035]"
      }`}
    >
      <p className="text-[9px] uppercase tracking-[0.16em] text-white/40">
        {label}
      </p>
      <p
        className={`mt-1.5 text-2xl font-semibold tabular-nums ${
          warning ? "text-amber-100" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function CrewDispatchCard({
  member,
  timezone,
}: {
  member: TechnicianDispatchCrewMember;
  timezone: string;
}) {
  const dispatchState = DISPATCH_STATE_COPY[member.dispatchState];
  const passState = PASS_STATE_COPY[member.fieldPassState];
  const focusStop =
    member.attentionStop ?? member.activeStop ?? member.nextStop;
  const focusLabel = member.attentionStop
    ? "Owner action"
    : member.activeStop
      ? "Live now"
      : member.nextStop
        ? "Next action"
        : null;
  const progress = focusStop
    ? technicianVisitStageProgress(focusStop.fieldStage)
    : null;
  const needsPass =
    member.assignedStopCount > 0 &&
    (member.fieldPassState === "missing" ||
      member.fieldPassState === "pending" ||
      member.fieldPassState === "expired" ||
      member.fieldPassState === "revoked");

  return (
    <li className="rounded-[1.5rem] border border-white/10 bg-[#111615] p-5 [content-visibility:auto] [contain-intrinsic-size:auto_24rem] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xl font-semibold text-white">
            {member.displayName}
          </p>
          <p className="mt-1 text-xs text-white/40">
            {member.assignedStopCount} stop
            {member.assignedStopCount === 1 ? "" : "s"} · {member.jobberCompleteStopCount}{" "}
            Jobber complete · {member.documentedStopCount} documented
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] ${dispatchState.className}`}
        >
          {dispatchState.label}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span
          className={`rounded-full border px-3 py-1 text-[10px] ${passState.className}`}
        >
          {passState.label}
        </span>
        {member.actionRequiredStopCount > 0 ? (
          <span className="rounded-full border border-amber-300/25 px-3 py-1 text-[10px] text-amber-100">
            {member.actionRequiredStopCount} stop
            {member.actionRequiredStopCount === 1 ? "" : "s"} need action
          </span>
        ) : null}
        {member.portalUpdatedStopCount > 0 ? (
          <span className="rounded-full border border-emerald-300/20 px-3 py-1 text-[10px] text-emerald-100/80">
            {member.portalUpdatedStopCount} portal updated
          </span>
        ) : null}
      </div>

      {focusStop && focusLabel ? (
        <div
          className={`mt-5 rounded-2xl border p-4 ${
            member.attentionStop
              ? "border-amber-300/25 bg-amber-300/[0.06]"
              : member.activeStop
                ? "border-accent/25 bg-accent/[0.055]"
                : "border-white/10 bg-white/[0.025]"
          }`}
        >
          <div className="flex items-center justify-between gap-4">
            <p className="text-[9px] uppercase tracking-[0.18em] text-white/45">
              {focusLabel}
            </p>
            <p className="text-xs tabular-nums text-white/55">
              {formatTimeRange(
                focusStop.scheduledStart,
                focusStop.scheduledEnd,
                timezone,
              )}
            </p>
          </div>
          <p className="mt-2 truncate font-serif text-xl text-white">
            {focusStop.clientName}
          </p>
          <p className="mt-1 truncate text-xs text-white/45">
            {focusStop.serviceLabel}
          </p>

          {progress && focusStop.fieldStage !== "not_started" ? (
            <div className="mt-4">
              <div className="flex items-center justify-between gap-3 text-[10px]">
                <span className="text-accent">
                  {technicianVisitStageLabel(focusStop.fieldStage)}
                </span>
                <span className="tabular-nums text-white/40">
                  {progress.completed}/{progress.total}
                </span>
              </div>
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"
                role="progressbar"
                aria-label={`${member.displayName} visit progress`}
                aria-valuemin={0}
                aria-valuemax={progress.total}
                aria-valuenow={progress.completed}
              >
                <div
                  className="h-full rounded-full bg-accent"
                  style={{
                    width: `${(progress.completed / progress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          ) : null}

          <Link
            href={focusStop.todayHref}
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-4 text-xs text-white/75 transition hover:border-white/30 hover:text-white"
          >
            Open exact stop
          </Link>
        </div>
      ) : (
        <p className="mt-5 rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-xs leading-relaxed text-white/40">
          No Jobber stops assigned today.
        </p>
      )}

      {needsPass ? (
        <a
          href={`#${technicianFieldPassAnchorId(member.jobberUserId)}`}
          className="mt-4 inline-flex min-h-11 items-center text-xs font-medium text-amber-100 underline decoration-amber-200/30 underline-offset-4"
        >
          Set up Technician Access
        </a>
      ) : null}
    </li>
  );
}

export function TechnicianDispatchBoard({
  board,
}: {
  board: TechnicianDispatchBoardView;
}) {
  const hasOwnerAttention =
    board.summary.attentionCrew > 0 ||
    board.summary.unassignedStops > 0 ||
    board.summary.assignmentUnknownStops > 0;

  return (
    <section
      aria-labelledby="technician-dispatch-heading"
      className="mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-black/20 p-5 shadow-[0_28px_90px_rgba(0,0,0,0.24)] sm:p-7"
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-accent">
            Today · Dispatch control
          </p>
          <h2
            id="technician-dispatch-heading"
            className="mt-2 font-serif text-3xl font-light text-white sm:text-4xl"
          >
            The field, without the guessing.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/50">
            Jobber owns assignments. HomeAtlas shows phone access, live route
            stages, service proof, and the exact stop that needs HQ.
          </p>
        </div>
        <p aria-live="polite" className="text-xs text-white/35">
          Updated {formatTime(board.loadedAt, board.timezone)}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <DispatchMetric label="Today's stops" value={board.summary.scheduledStops} />
        <DispatchMetric label="Crew scheduled" value={board.summary.scheduledCrew} />
        <DispatchMetric label="Live now" value={board.summary.activeCrew} />
        <DispatchMetric label="Ready" value={board.summary.readyCrew} />
        <DispatchMetric label="Route closed" value={board.summary.doneCrew} />
        <DispatchMetric
          label="Needs attention"
          value={board.summary.attentionCrew}
          warning={board.summary.attentionCrew > 0}
        />
      </div>

      {hasOwnerAttention ? (
        <div className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-300/[0.065] p-4 text-xs leading-relaxed text-amber-100/80">
          <p className="font-medium text-amber-100">Owner dispatch check</p>
          <ul className="mt-2 space-y-1">
            {board.summary.crewWithoutUsablePass > 0 ? (
              <li>
                {board.summary.crewWithoutUsablePass} scheduled crew member
                {board.summary.crewWithoutUsablePass === 1 ? " needs" : "s need"}{" "}
                active Technician Access.
              </li>
            ) : null}
            {board.summary.unassignedStops > 0 ? (
              <li>
                {board.summary.unassignedStops} Jobber stop
                {board.summary.unassignedStops === 1 ? " is" : "s are"} unassigned.
              </li>
            ) : null}
            {board.summary.assignmentUnknownStops > 0 ? (
              <li>
                {board.summary.assignmentUnknownStops} stop
                {board.summary.assignmentUnknownStops === 1 ? " has" : "s have"}{" "}
                unverified crew visibility; dispatch from Jobber until refreshed.
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {!board.fieldEventStatusAvailable || !board.fieldRecordStatusAvailable ? (
        <p className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-300/[0.05] p-4 text-xs leading-relaxed text-rose-100/75">
          {!board.fieldEventStatusAvailable
            ? "Live route stages are unavailable until migration 058 is active. "
            : ""}
          {!board.fieldRecordStatusAvailable
            ? "Service-proof checks are unavailable until migration 054 is active."
            : ""}
          No missing data is being treated as completed work.
        </p>
      ) : null}

      {board.crew.length > 0 ? (
        <ul className="mt-5 grid gap-4 lg:grid-cols-2">
          {board.crew.map((member) => (
            <CrewDispatchCard
              key={member.jobberUserId}
              member={member}
              timezone={board.timezone}
            />
          ))}
        </ul>
      ) : (
        <p className="mt-5 rounded-2xl border border-white/10 p-6 text-sm text-white/45">
          No mirrored Jobber crew is available yet.
        </p>
      )}
    </section>
  );
}
