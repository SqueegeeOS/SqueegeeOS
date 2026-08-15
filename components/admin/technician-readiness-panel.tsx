"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import {
  TECHNICIAN_COMPETENCIES,
  type IndependentDayOutcome,
  type TechnicianCompetencyId,
  type TechnicianCompetencyRating,
  type TechnicianReadinessSnapshot,
} from "@/lib/field-operations/technician-readiness";

const OUTCOME_COPY: Record<
  IndependentDayOutcome,
  { label: string; detail: string; className: string }
> = {
  planned: {
    label: "Planned",
    detail: "HomeAtlas will evaluate the complete Jobber route after it runs.",
    className: "border-sky-300/25 bg-sky-300/[0.08] text-sky-100",
  },
  in_progress: {
    label: "Route in progress",
    detail: "The day stays open until every assigned stop is complete.",
    className: "border-amber-300/25 bg-amber-300/[0.08] text-amber-100",
  },
  needs_schedule: {
    label: "Needs Jobber route",
    detail: "Assign at least one Jobber stop to this technician on the trial date.",
    className: "border-amber-300/25 bg-amber-300/[0.08] text-amber-100",
  },
  needs_review: {
    label: "Needs closeout review",
    detail: "Every assigned stop needs a completed HomeAtlas independence review.",
    className: "border-amber-300/25 bg-amber-300/[0.08] text-amber-100",
  },
  verified: {
    label: "Independent day verified",
    detail: "Every assigned stop completed with verified quality and zero owner help.",
    className: "border-emerald-300/30 bg-emerald-300/[0.1] text-emerald-100",
  },
  did_not_verify: {
    label: "Did not verify",
    detail: "At least one assigned stop needed owner help, rework, or another exception.",
    className: "border-red-300/25 bg-red-300/[0.08] text-red-100",
  },
  source_unavailable: {
    label: "Source unavailable",
    detail: "Jobber connection or assignment evidence is incomplete. HomeAtlas fails closed.",
    className: "border-red-300/25 bg-red-300/[0.08] text-red-100",
  },
  cancelled: {
    label: "Cancelled",
    detail: "This trial remains in history but does not count as evidence.",
    className: "border-white/10 bg-white/[0.04] text-white/55",
  },
};

function formatDate(value: string | null): string {
  if (!value) return "No verified visit yet";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function ratingLabel(rating: TechnicianCompetencyRating | undefined): string {
  if (rating === "independent") return "Independent";
  if (rating === "supervised") return "Supervised";
  if (rating === "learning") return "Learning";
  return "Not observed";
}

export function TechnicianReadinessPanel() {
  const [snapshot, setSnapshot] = useState<TechnicianReadinessSnapshot | null>(
    null,
  );
  const [selectedTechnicianId, setSelectedTechnicianId] = useState("");
  const [competency, setCompetency] = useState<TechnicianCompetencyId>(
    "route_ownership",
  );
  const [rating, setRating] =
    useState<TechnicianCompetencyRating>("supervised");
  const [evidenceNote, setEvidenceNote] = useState("");
  const [trialDate, setTrialDate] = useState("");
  const [planNote, setPlanNote] = useState("");
  const [cancelTrialId, setCancelTrialId] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    if (!silent) setError(null);
    try {
      const response = await fetch("/api/admin/technicians/readiness", {
        headers: getAdminRequestHeaders(),
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as
        | (TechnicianReadinessSnapshot & { error?: string })
        | null;
      if (!response.ok || !body) {
        throw new Error(body?.error ?? "Could not load technician readiness.");
      }
      setSnapshot(body);
      setSelectedTechnicianId((current) =>
        body.technicians.some(
          (technician) => technician.jobberUserId === current,
        )
          ? current
          : (body.technicians.find(
              (technician) => technician.mirroredRosterActive,
            )?.jobberUserId ?? body.technicians[0]?.jobberUserId ?? ""),
      );
      setTrialDate((current) => current || body.today);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load technician readiness.",
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const selected = useMemo(
    () =>
      snapshot?.technicians.find(
        (technician) => technician.jobberUserId === selectedTechnicianId,
      ) ?? null,
    [selectedTechnicianId, snapshot],
  );
  const selectedTrials = useMemo(
    () =>
      snapshot?.trials.filter(
        (trial) => trial.jobberUserId === selectedTechnicianId,
      ) ?? [],
    [selectedTechnicianId, snapshot],
  );

  async function postAction(
    action: string,
    payload: Record<string, unknown>,
    successMessage: string,
  ) {
    setBusy(action);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/technicians/readiness", {
        method: "POST",
        headers: getAdminRequestHeaders(),
        body: JSON.stringify({ action, ...payload }),
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Readiness action failed.");
      }
      setNotice(successMessage);
      await load(true);
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Readiness action failed.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function saveAssessment() {
    if (!selected) return;
    await postAction(
      "record_competency",
      {
        jobberUserId: selected.jobberUserId,
        displayName: selected.displayName,
        competency,
        rating,
        evidenceNote,
      },
      "Competency evidence added without rewriting earlier observations.",
    );
    setEvidenceNote("");
  }

  async function planDay() {
    if (!selected) return;
    await postAction(
      "plan_independent_day",
      {
        jobberUserId: selected.jobberUserId,
        displayName: selected.displayName,
        trialDate,
        planNote,
      },
      "Independent day planned. Its result will come from the complete route evidence.",
    );
    setPlanNote("");
  }

  async function cancelDay() {
    if (!cancelTrialId) return;
    await postAction(
      "cancel_independent_day",
      { trialId: cancelTrialId, reason: cancellationReason },
      "Trial cancelled and preserved in history.",
    );
    setCancelTrialId(null);
    setCancellationReason("");
  }

  if (loading && !snapshot) {
    return (
      <section className="mt-8 rounded-[2rem] border border-white/10 bg-black/20 p-8 text-center text-sm text-muted">
        Building the independent-day readiness file…
      </section>
    );
  }

  return (
    <section className="mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-[#0d1211]">
      <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(155,226,189,0.14),transparent_48%)] p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-3xl">
            <p className="text-[10px] uppercase tracking-[0.2em] text-accent">
              Owner time buyback · Readiness file
            </p>
            <h2 className="mt-2 font-serif text-3xl font-light tracking-[-0.03em] text-white sm:text-4xl">
              Prove the first day Noah does not need to be there.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55">
              Eight observed skills prepare the technician. The result itself is
              source-backed: every assigned Jobber stop must finish with verified
              quality, complete closeout evidence, and zero owner intervention.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || busy !== null}
            className="min-h-12 shrink-0 rounded-full border border-white/10 px-5 text-xs text-white/65 disabled:opacity-40"
          >
            {loading ? "Refreshing…" : "Refresh evidence"}
          </button>
        </div>

        {snapshot ? (
          <div className="mt-5 flex flex-wrap gap-2">
            <span
              className={`rounded-full border px-3 py-1.5 text-[11px] ${
                snapshot.jobberConnected
                  ? "border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-100"
                  : "border-red-300/25 bg-red-300/[0.08] text-red-100"
              }`}
            >
              Jobber {snapshot.jobberStatus.replaceAll("_", " ")}
            </span>
            <span
              className={`rounded-full border px-3 py-1.5 text-[11px] ${
                snapshot.schemaAvailable
                  ? "border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-100"
                  : "border-amber-300/25 bg-amber-300/[0.08] text-amber-100"
              }`}
            >
              {snapshot.schemaAvailable
                ? "Readiness ledger ready"
                : "Migration 062 required"}
            </span>
            <span
              className={`rounded-full border px-3 py-1.5 text-[11px] ${
                snapshot.jobberDataFresh
                  ? "border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-100"
                  : "border-amber-300/25 bg-amber-300/[0.08] text-amber-100"
              }`}
            >
              {snapshot.jobberDataFresh
                ? "Jobber data fresh"
                : "Fresh Jobber sync required"}
            </span>
          </div>
        ) : null}
      </div>

      <div className="p-5 sm:p-7">
        {error ? (
          <p
            role="alert"
            className="mb-4 rounded-xl border border-red-300/25 bg-red-300/[0.07] p-4 text-sm text-red-100"
          >
            {error}
          </p>
        ) : null}
        {notice ? (
          <p
            role="status"
            className="mb-4 rounded-xl border border-emerald-300/25 bg-emerald-300/[0.07] p-4 text-sm text-emerald-100"
          >
            {notice}
          </p>
        ) : null}
        {snapshot?.warnings.map((warning) => (
          <p
            key={warning}
            className="mb-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] p-4 text-xs leading-relaxed text-amber-100/80"
          >
            {warning}
          </p>
        ))}

        {snapshot && snapshot.technicians.length > 0 ? (
          <>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {snapshot.technicians.map((technician) => (
                <button
                  key={technician.jobberUserId}
                  type="button"
                  onClick={() => setSelectedTechnicianId(technician.jobberUserId)}
                  className={`min-h-12 shrink-0 rounded-full border px-5 text-sm transition ${
                    selectedTechnicianId === technician.jobberUserId
                      ? "border-accent/50 bg-accent text-[#07110c]"
                      : "border-white/10 bg-white/[0.035] text-white/65"
                  }`}
                >
                  {technician.displayName}
                  {technician.evidenceCompleteForOwnerDecision ? " · evidence ready" : ""}
                </button>
              ))}
            </div>

            {selected ? (
              <div className="mt-5">
                {!selected.mirroredRosterActive ? (
                  <p className="mb-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] p-4 text-xs text-amber-100/80">
                    This historical technician is not in the current mirrored Jobber
                    roster. Evidence remains visible, but new actions are disabled.
                  </p>
                ) : null}

                <div
                  className={`rounded-[1.4rem] border p-5 ${
                    selected.evidenceCompleteForOwnerDecision
                      ? "border-emerald-300/30 bg-emerald-300/[0.07]"
                      : "border-white/10 bg-white/[0.025]"
                  }`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                        {selected.displayName} · Owner decision file
                      </p>
                      <p className="mt-2 text-xl font-semibold text-white">
                        {selected.evidenceCompleteForOwnerDecision
                          ? "Evidence complete for Noah’s decision"
                          : `${selected.independentCompetencyCount}/8 skills independently observed`}
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-white/45">
                        Evidence completeness does not automatically approve a route.
                        Noah still owns the safety and staffing decision.
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center sm:min-w-72">
                      {[
                        [selected.independentJobs, "clean jobs"],
                        [selected.independentHours.toFixed(1), "hours"],
                        [selected.ownerInterventionJobs, "owner assists"],
                      ].map(([value, label]) => (
                        <div key={label} className="rounded-xl border border-white/10 bg-black/20 p-3">
                          <p className="text-lg font-semibold text-white">{value}</p>
                          <p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-white/35">
                            {label}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    {selected.evidenceGates.map((gate) => (
                      <div
                        key={gate.id}
                        className={`rounded-xl border p-3 ${
                          gate.passed
                            ? "border-emerald-300/20 bg-emerald-300/[0.05]"
                            : "border-white/10 bg-black/15"
                        }`}
                      >
                        <p className="text-xs font-medium text-white">
                          {gate.passed ? "✓ " : "○ "}
                          {gate.label}
                        </p>
                        <p className="mt-1 text-[11px] leading-relaxed text-white/40">
                          {gate.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] text-white/35">
                    Last clean independent visit: {formatDate(selected.lastIndependentServiceDate)}
                    {selected.qualityExceptionJobs > 0
                      ? ` · ${selected.qualityExceptionJobs} quality/exception review${selected.qualityExceptionJobs === 1 ? "" : "s"}`
                      : " · no open quality exception in the evidence window"}
                  </p>
                </div>

                <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
                  <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.025] p-5">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-accent/75">
                      Eight observable skills
                    </p>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {selected.competencies.map((item) => {
                        const latest = item.latestAssessment;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setCompetency(item.id)}
                            className={`min-h-28 rounded-xl border p-4 text-left ${
                              competency === item.id
                                ? "border-accent/40 bg-accent/[0.06]"
                                : "border-white/10 bg-black/15"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-sm font-medium text-white">{item.label}</p>
                              <span
                                className={`shrink-0 rounded-full border px-2 py-1 text-[9px] uppercase tracking-[0.1em] ${
                                  latest?.rating === "independent"
                                    ? "border-emerald-300/25 text-emerald-100"
                                    : "border-white/10 text-white/40"
                                }`}
                              >
                                {ratingLabel(latest?.rating)}
                              </span>
                            </div>
                            <p className="mt-2 text-[11px] leading-relaxed text-white/38">
                              {latest?.evidenceNote ?? item.detail}
                            </p>
                            {latest ? (
                              <p className="mt-2 text-[9px] text-white/25">
                                Added {formatDateTime(latest.assessedAt)}
                              </p>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-5 border-t border-white/10 pt-5">
                      <p className="text-sm font-medium text-white">Add a new observation</p>
                      <p className="mt-1 text-xs text-white/40">
                        New evidence becomes current; older evidence remains in the audit history.
                      </p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <label className="text-xs text-white/55">
                          Skill
                          <select
                            value={competency}
                            onChange={(event) =>
                              setCompetency(event.target.value as TechnicianCompetencyId)
                            }
                            className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-[#111615] px-3 text-sm text-white outline-none focus:border-accent/50"
                          >
                            {TECHNICIAN_COMPETENCIES.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-xs text-white/55">
                          Observed level
                          <select
                            value={rating}
                            onChange={(event) =>
                              setRating(
                                event.target.value as TechnicianCompetencyRating,
                              )
                            }
                            className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-[#111615] px-3 text-sm text-white outline-none focus:border-accent/50"
                          >
                            <option value="learning">Learning</option>
                            <option value="supervised">Supervised</option>
                            <option value="independent">Independent</option>
                          </select>
                        </label>
                      </div>
                      <label className="mt-3 block text-xs text-white/55">
                        What did you personally observe?
                        <textarea
                          value={evidenceNote}
                          onChange={(event) => setEvidenceNote(event.target.value)}
                          maxLength={1_000}
                          rows={3}
                          placeholder="Example: Loaded the route, confirmed each scope, handled access notes, and closed all three stops without prompting."
                          className="mt-2 w-full rounded-xl border border-white/10 bg-[#111615] p-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-accent/50"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => void saveAssessment()}
                        disabled={
                          busy !== null ||
                          !snapshot?.schemaAvailable ||
                          !selected.mirroredRosterActive ||
                          evidenceNote.trim().length < 10
                        }
                        className="mt-3 min-h-12 w-full rounded-xl bg-accent px-5 text-sm font-semibold text-[#07110c] disabled:opacity-35"
                      >
                        {busy === "record_competency"
                          ? "Saving evidence…"
                          : "Add append-only evidence"}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.025] p-5">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-accent/75">
                        Schedule the proof
                      </p>
                      <h3 className="mt-2 text-xl font-semibold text-white">
                        First independent day
                      </h3>
                      <p className="mt-2 text-xs leading-relaxed text-white/40">
                        Plan the date here, then build the real route in Jobber. HomeAtlas
                        will grade every assigned stop—not a sample and not a checkbox.
                      </p>
                      <label className="mt-4 block text-xs text-white/55">
                        Trial date
                        <input
                          type="date"
                          value={trialDate}
                          min={snapshot?.today}
                          onChange={(event) => setTrialDate(event.target.value)}
                          className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-[#111615] px-3 text-sm text-white outline-none focus:border-accent/50"
                        />
                      </label>
                      <label className="mt-3 block text-xs text-white/55">
                        Route plan (optional)
                        <textarea
                          value={planNote}
                          onChange={(event) => setPlanNote(event.target.value)}
                          maxLength={1_000}
                          rows={3}
                          placeholder="Normal route, stocked vehicle, Noah available by phone for safety escalation only."
                          className="mt-2 w-full rounded-xl border border-white/10 bg-[#111615] p-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-accent/50"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => void planDay()}
                        disabled={
                          busy !== null ||
                          !snapshot?.schemaAvailable ||
                          !selected.mirroredRosterActive ||
                          !trialDate
                        }
                        className="mt-3 min-h-12 w-full rounded-xl border border-accent/40 bg-accent/[0.1] px-5 text-sm font-medium text-accent disabled:opacity-35"
                      >
                        {busy === "plan_independent_day"
                          ? "Planning…"
                          : "Plan source-backed trial"}
                      </button>
                    </div>

                    <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.025] p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                            Trial history
                          </p>
                          <h3 className="mt-2 text-lg font-semibold text-white">
                            All-stop evidence
                          </h3>
                        </div>
                        <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] text-white/40">
                          {selectedTrials.length}
                        </span>
                      </div>

                      {selectedTrials.length > 0 ? (
                        <div className="mt-4 space-y-3">
                          {selectedTrials.map((trial) => {
                            const outcome = OUTCOME_COPY[trial.outcome];
                            const isCancelling = cancelTrialId === trial.id;
                            return (
                              <div
                                key={trial.id}
                                className="rounded-xl border border-white/10 bg-black/20 p-4"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-medium text-white">
                                      {formatDate(trial.trialDate)}
                                    </p>
                                    <p className="mt-1 text-[10px] text-white/35">
                                      {trial.completedStops}/{trial.scheduledStops} complete · {trial.reviewedStops}/{trial.scheduledStops} reviewed · {trial.qualifyingIndependentStops}/{trial.scheduledStops} clean
                                    </p>
                                  </div>
                                  <span
                                    className={`rounded-full border px-2.5 py-1 text-[9px] ${outcome.className}`}
                                  >
                                    {outcome.label}
                                  </span>
                                </div>
                                <p className="mt-3 text-[11px] leading-relaxed text-white/42">
                                  {outcome.detail}
                                </p>
                                {trial.planNote ? (
                                  <p className="mt-2 text-[11px] leading-relaxed text-white/32">
                                    Plan: {trial.planNote}
                                  </p>
                                ) : null}
                                {trial.cancellationReason ? (
                                  <p className="mt-2 text-[11px] text-white/32">
                                    Cancelled: {trial.cancellationReason}
                                  </p>
                                ) : null}
                                {trial.status === "planned" ? (
                                  isCancelling ? (
                                    <div className="mt-3">
                                      <input
                                        value={cancellationReason}
                                        onChange={(event) =>
                                          setCancellationReason(event.target.value)
                                        }
                                        maxLength={1_000}
                                        placeholder="Why is this trial changing?"
                                        className="min-h-11 w-full rounded-xl border border-red-300/20 bg-[#111615] px-3 text-xs text-white outline-none"
                                      />
                                      <div className="mt-2 flex gap-2">
                                        <button
                                          type="button"
                                          onClick={() => void cancelDay()}
                                          disabled={
                                            busy !== null ||
                                            cancellationReason.trim().length < 5
                                          }
                                          className="min-h-11 flex-1 rounded-xl border border-red-300/25 text-xs text-red-100 disabled:opacity-35"
                                        >
                                          Confirm cancellation
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setCancelTrialId(null);
                                            setCancellationReason("");
                                          }}
                                          className="min-h-11 rounded-xl border border-white/10 px-4 text-xs text-white/45"
                                        >
                                          Keep
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setCancelTrialId(trial.id)}
                                      className="mt-3 min-h-10 rounded-xl border border-white/10 px-3 text-[11px] text-white/40"
                                    >
                                      Cancel trial
                                    </button>
                                  )
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="mt-4 rounded-xl border border-dashed border-white/10 p-5 text-center text-xs leading-relaxed text-white/35">
                          No independent day is planned yet. Build readiness first,
                          then choose one normal route worth proving.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-white/40">
            Sync a Jobber route with an assigned technician before building a readiness file.
          </p>
        )}
      </div>
    </section>
  );
}
