"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { HqFounderNav } from "@/components/admin/hq-founder-nav";
import { AmbientStage } from "@/components/craft/ambient-stage";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import { useAdminUnlockedState } from "@/lib/admin/use-admin-unlocked-state";
import type { TechnicianOperationalProfile } from "@/lib/field-operations/technician-profile";

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatHours(minutes: number): string {
  const hours = minutes / 60;
  return `${hours.toFixed(hours >= 10 ? 1 : 2)}h`;
}

function labelize(value: string): string {
  return value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[1.25rem] border border-foreground/10 bg-foreground/[0.035] p-4 sm:p-5">
      <p className="text-[9px] uppercase tracking-[0.2em] text-muted">{label}</p>
      <p className="mt-2 font-serif text-3xl font-light tracking-[-0.03em] text-foreground">
        {value}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-muted">{detail}</p>
    </div>
  );
}

function stateClass(value: string): string {
  if (value === "active" || value === "independent" || value === "verified") {
    return "border-success/30 bg-success/[0.08] text-success";
  }
  if (value === "pending" || value === "expiring" || value === "supervised") {
    return "border-warning/30 bg-warning/[0.08] text-warning";
  }
  if (value === "revoked" || value === "expired" || value === "learning") {
    return "border-danger/25 bg-danger/[0.07] text-danger";
  }
  return "border-foreground/10 bg-foreground/[0.035] text-muted";
}

export function TechnicianProfilePage({ technicianId }: { technicianId: string }) {
  const [unlocked, setUnlocked] = useAdminUnlockedState();
  const [profile, setProfile] = useState<TechnicianOperationalProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!unlocked) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/technicians/${encodeURIComponent(technicianId)}/profile`,
        { headers: getAdminRequestHeaders(), cache: "no-store" },
      );
      const body = (await response.json().catch(() => null)) as
        | { profile?: TechnicianOperationalProfile; error?: string }
        | null;
      if (!response.ok || !body?.profile) {
        throw new Error(body?.error ?? "Technician profile could not load.");
      }
      setProfile(body.profile);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Technician profile could not load.",
      );
    } finally {
      setLoading(false);
    }
  }, [technicianId, unlocked]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const initials = useMemo(
    () =>
      profile?.technician.displayName
        .split(/\s+/)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() ?? "TG",
    [profile],
  );

  if (!unlocked) return <AdminPinGate onUnlock={() => setUnlocked(true)} />;

  return (
    <AmbientStage className="min-h-screen text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-5 pb-24 sm:px-6 sm:py-7">
        <HqFounderNav />

        <div className="mt-7 flex items-center justify-between gap-3">
          <Link
            href="/hq/technicians"
            className="inline-flex min-h-11 items-center rounded-full border border-foreground/10 px-4 text-xs text-muted transition hover:text-foreground"
          >
            ← Team control
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="min-h-11 rounded-full border border-foreground/10 px-4 text-xs text-muted disabled:opacity-50"
          >
            {loading ? "Refreshing…" : "Refresh data"}
          </button>
        </div>

        {error ? (
          <p role="alert" className="mt-6 rounded-2xl border border-danger/25 bg-danger/[0.07] p-5 text-sm text-danger">
            {error}
          </p>
        ) : null}

        {!profile && loading ? (
          <section className="mt-8 rounded-[2rem] border border-foreground/10 bg-background/60 p-12 text-center text-sm text-muted">
            Building technician backend profile…
          </section>
        ) : null}

        {profile ? (
          <>
            <header className="mt-8 rounded-[2rem] border border-foreground/10 bg-surface-elevated p-5 sm:p-8">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4 sm:gap-5">
                  <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full border border-accent/25 bg-accent/[0.07] font-serif text-2xl text-accent sm:h-20 sm:w-20 sm:text-3xl">
                    {initials}
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-accent">
                      HQ · Technician backend
                    </p>
                    <h1 className="mt-2 font-serif text-4xl font-light tracking-[-0.04em] sm:text-5xl">
                      {profile.technician.displayName}
                    </h1>
                    <p className="mt-2 text-sm text-muted">
                      {profile.technician.roleTitle} · HomeAtlas-native technician
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <span className={`rounded-full border px-3 py-1.5 text-[11px] ${stateClass(profile.technician.status)}`}>
                    Staff {profile.technician.status}
                  </span>
                  <span className={`rounded-full border px-3 py-1.5 text-[11px] ${stateClass(profile.access.state)}`}>
                    Access {profile.access.state}
                  </span>
                </div>
              </div>
              <p className="mt-6 text-xs leading-relaxed text-muted">
                Live operational profile generated {formatDateTime(profile.generatedAt)}. This page reads existing field, readiness, capacity, and access data; it does not expose customer-facing controls.
              </p>
            </header>

            {profile.warnings.length > 0 ? (
              <section className="mt-5 rounded-[1.5rem] border border-warning/20 bg-warning/[0.05] p-5">
                <p className="text-[10px] uppercase tracking-[0.18em] text-warning">Data notes</p>
                <ul className="mt-3 space-y-2 text-xs leading-relaxed text-warning/90">
                  {profile.warnings.map((warning) => (
                    <li key={warning}>• {warning}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard
                label="Readiness"
                value={`${profile.readiness?.independentCompetencyCount ?? 0}/${profile.readiness?.competencies.length ?? 8}`}
                detail={profile.readiness?.evidenceCompleteForOwnerDecision ? "Evidence complete for an owner decision." : "Competency evidence is still being built."}
              />
              <MetricCard
                label="Independent work"
                value={`${profile.readiness?.independentJobs ?? 0}`}
                detail={`${profile.readiness?.independentHours ?? 0} verified independent hours.`}
              />
              <MetricCard
                label="30-day closeouts"
                value={`${profile.activity.closeouts}`}
                detail={`${profile.activity.followUpCloseouts} flagged for follow-up.`}
              />
              <MetricCard
                label="30-day clock"
                value={formatHours(profile.activity.clockedMinutes)}
                detail={`${profile.activity.activeClocks} job clock${profile.activity.activeClocks === 1 ? "" : "s"} currently open.`}
              />
            </section>

            <section className="mt-7 rounded-[2rem] border border-foreground/10 bg-surface-elevated p-5 sm:p-7">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-accent">Readiness ledger</p>
                  <h2 className="mt-2 text-2xl font-semibold">Eight field competencies</h2>
                </div>
                {profile.readiness ? (
                  <span className="text-xs text-muted">
                    Last independent service {formatDate(profile.readiness.lastIndependentServiceDate)}
                  </span>
                ) : null}
              </div>

              {profile.readiness ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {profile.readiness.competencies.map((competency) => {
                    const rating = competency.latestAssessment?.rating ?? "not assessed";
                    return (
                      <article key={competency.id} className="rounded-[1.2rem] border border-foreground/10 bg-background/30 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">{competency.label}</p>
                            <p className="mt-1 text-xs leading-relaxed text-muted">{competency.detail}</p>
                          </div>
                          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] ${stateClass(rating)}`}>
                            {labelize(rating)}
                          </span>
                        </div>
                        {competency.latestAssessment ? (
                          <div className="mt-3 border-t border-foreground/10 pt-3">
                            <p className="text-xs leading-relaxed text-foreground/75">
                              {competency.latestAssessment.evidenceNote}
                            </p>
                            <p className="mt-2 text-[10px] text-muted">
                              Assessed {formatDateTime(competency.latestAssessment.assessedAt)}
                            </p>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-5 text-sm text-muted">No readiness snapshot is available yet.</p>
              )}
            </section>

            <section className="mt-7 rounded-[2rem] border border-foreground/10 bg-surface-elevated p-5 sm:p-7">
              <p className="text-[10px] uppercase tracking-[0.2em] text-accent">Operational activity</p>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  ["Assignments", profile.activity.assignments],
                  ["Closeouts", profile.activity.closeouts],
                  ["Field events", profile.activity.visitEvents],
                  ["Follow-ups", profile.activity.followUpCloseouts],
                  ["Scope exceptions", profile.activity.scopeExceptionCloseouts],
                  ["Clocked", formatHours(profile.activity.clockedMinutes)],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl border border-foreground/10 bg-background/30 p-3">
                    <p className="text-[9px] uppercase tracking-[0.16em] text-muted">{label}</p>
                    <p className="mt-2 text-xl font-semibold text-foreground">{value}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-muted">
                Rolling {profile.activity.windowDays}-day window · latest backend activity {formatDateTime(profile.activity.lastActivityAt)}.
              </p>
            </section>

            <section className="mt-7 rounded-[2rem] border border-foreground/10 bg-surface-elevated p-5 sm:p-7">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-accent">Capacity</p>
                  <h2 className="mt-2 text-2xl font-semibold">Upcoming production load</h2>
                </div>
              </div>
              {profile.capacity ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {profile.capacity.weeks.slice(0, 4).map((week) => (
                    <article key={week.weekStart} className="rounded-[1.2rem] border border-foreground/10 bg-background/30 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">Week of {formatDate(week.weekStart)}</p>
                          <p className="mt-1 text-xs text-muted">{week.detail}</p>
                        </div>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] ${week.overCapacity ? "border-danger/25 bg-danger/[0.07] text-danger" : stateClass(week.state)}`}>
                          {week.utilizationPercent == null ? labelize(week.state) : `${Math.round(week.utilizationPercent)}%`}
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                        <div><p className="text-lg font-semibold">{week.scheduledStops ?? "—"}</p><p className="text-[9px] uppercase tracking-[0.14em] text-muted">Stops</p></div>
                        <div><p className="text-lg font-semibold">{week.scheduledMinutes == null ? "—" : formatHours(week.scheduledMinutes)}</p><p className="text-[9px] uppercase tracking-[0.14em] text-muted">Booked</p></div>
                        <div><p className="text-lg font-semibold">{week.capacityMinutes == null ? "—" : formatHours(week.capacityMinutes)}</p><p className="text-[9px] uppercase tracking-[0.14em] text-muted">Capacity</p></div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="mt-5 text-sm text-muted">No capacity snapshot is available yet.</p>
              )}
            </section>

            <section className="mt-7 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
              <div className="rounded-[2rem] border border-foreground/10 bg-surface-elevated p-5 sm:p-7">
                <p className="text-[10px] uppercase tracking-[0.2em] text-accent">Recent closeouts</p>
                <div className="mt-4 space-y-3">
                  {profile.recentCloseouts.length > 0 ? profile.recentCloseouts.map((closeout) => (
                    <article key={closeout.id} className="rounded-[1.15rem] border border-foreground/10 bg-background/30 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{formatDate(closeout.visitDate)}</p>
                          <p className="mt-1 font-mono text-[10px] text-muted">Visit {closeout.externalVisitId}</p>
                        </div>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] ${closeout.followUpNeeded ? "border-warning/30 bg-warning/[0.08] text-warning" : "border-success/30 bg-success/[0.08] text-success"}`}>
                          {closeout.followUpNeeded ? "Follow-up" : "Closed"}
                        </span>
                      </div>
                      <p className="mt-3 text-xs text-muted">Scope read: {labelize(closeout.scopeReadState)}</p>
                      {closeout.scopeException ? (
                        <p className="mt-2 text-xs leading-relaxed text-warning">Exception: {closeout.scopeException}</p>
                      ) : null}
                    </article>
                  )) : <p className="text-sm text-muted">No HomeAtlas closeouts in this 30-day window yet.</p>}
                </div>
              </div>

              <div className="space-y-5">
                <section className="rounded-[2rem] border border-foreground/10 bg-surface-elevated p-5 sm:p-7">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-accent">Field access</p>
                  <dl className="mt-4 grid gap-3 text-sm">
                    <div className="flex justify-between gap-4"><dt className="text-muted">State</dt><dd>{labelize(profile.access.state)}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-muted">Claimed</dt><dd className="text-right">{formatDateTime(profile.access.claimedAt)}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-muted">Safety renewal</dt><dd className="text-right">{formatDateTime(profile.access.sessionExpiresAt)}</dd></div>
                  </dl>
                </section>

                <section className="rounded-[2rem] border border-foreground/10 bg-surface-elevated p-5 sm:p-7">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-accent">Independent-day trials</p>
                  <div className="mt-4 space-y-3">
                    {profile.trials.length > 0 ? profile.trials.slice(0, 5).map((trial) => (
                      <div key={trial.id} className="rounded-xl border border-foreground/10 bg-background/30 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium">{formatDate(trial.trialDate)}</p>
                          <span className={`rounded-full border px-2 py-1 text-[10px] ${stateClass(trial.outcome)}`}>{labelize(trial.outcome)}</span>
                        </div>
                        <p className="mt-2 text-xs text-muted">{trial.completedStops}/{trial.scheduledStops} stops complete · {trial.qualifyingIndependentStops} qualifying independent.</p>
                      </div>
                    )) : <p className="text-sm text-muted">No independent-day trials recorded yet.</p>}
                  </div>
                </section>
              </div>
            </section>

            <details className="mt-7 rounded-[1.5rem] border border-foreground/10 bg-background/30 p-5">
              <summary className="cursor-pointer text-sm font-medium text-foreground">Backend identifiers</summary>
              <dl className="mt-4 grid gap-3 break-all font-mono text-[11px] text-muted">
                <div><dt className="text-foreground/60">HomeAtlas technician ID</dt><dd className="mt-1">{profile.technician.id}</dd></div>
                <div><dt className="text-foreground/60">Field identity key</dt><dd className="mt-1">{profile.technician.identityKey}</dd></div>
                <div><dt className="text-foreground/60">Current access grant</dt><dd className="mt-1">{profile.access.grantId ?? "none"}</dd></div>
              </dl>
            </details>
          </>
        ) : null}
      </div>
    </AmbientStage>
  );
}
