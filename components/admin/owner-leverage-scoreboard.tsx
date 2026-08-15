"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import {
  GROWTH_CHANNELS,
  NEW_ARR_PER_GROWTH_DAY,
  OWNER_TIME_BUYBACK_LADDER_HOURS,
  type GrowthChannel,
  type GrowthDayBand,
  type OwnerLeverageSnapshot,
} from "@/lib/admin/owner-leverage";

const CHANNEL_LABELS: Record<GrowthChannel, string> = {
  door_to_door: "Door-to-door",
  google: "Google",
  paid_ads: "Paid ads",
  past_customer_reactivation: "Past customers",
  memberships: "Membership conversion",
  referrals: "Referrals",
  upsells: "Upsells",
  local_partnerships: "Local partnerships",
  other: "Other growth work",
};

const BAND_COPY: Record<
  GrowthDayBand,
  { label: string; className: string }
> = {
  below_floor: {
    label: "Below $500 floor",
    className: "border-amber-300/25 bg-amber-300/[0.07] text-amber-100",
  },
  floor: {
    label: "$500+ floor",
    className: "border-sky-300/25 bg-sky-300/[0.07] text-sky-100",
  },
  target: {
    label: "$1K+ target",
    className: "border-emerald-300/25 bg-emerald-300/[0.07] text-emerald-100",
  },
  excellent: {
    label: "$2K+ excellent",
    className: "border-accent/30 bg-accent/[0.08] text-accent",
  },
};

function money(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function hours(value: number): string {
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
  }).format(value)}h`;
}

function percent(value: number | null): string {
  return value == null
    ? "—"
    : `${new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 0,
      }).format(value)}%`;
}

function time(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function Metric({
  label,
  value,
  detail,
  accent = false,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <article
      className={`rounded-2xl border p-4 ${
        accent
          ? "border-accent/25 bg-accent/[0.06]"
          : "border-white/[0.08] bg-white/[0.025]"
      }`}
    >
      <p className="text-[9px] uppercase tracking-[0.16em] text-white/38">
        {label}
      </p>
      <p
        className={`mt-2 font-serif text-3xl tabular-nums ${
          accent ? "text-accent" : "text-[#f5f2eb]"
        }`}
      >
        {value}
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-white/42">{detail}</p>
    </article>
  );
}

async function readOwnerLeverage(): Promise<OwnerLeverageSnapshot> {
  const response = await fetch("/api/admin/owner-leverage", {
    headers: getAdminRequestHeaders(),
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as
    | (OwnerLeverageSnapshot & { error?: string })
    | { error?: string }
    | null;
  if (!response.ok || !body || !("metrics" in body)) {
    throw new Error(body?.error ?? "Owner leverage truth could not load.");
  }
  return body;
}

export function OwnerLeverageScoreboard() {
  const [snapshot, setSnapshot] = useState<OwnerLeverageSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [operatorSlug, setOperatorSlug] = useState("");
  const [channel, setChannel] = useState<GrowthChannel>("door_to_door");
  const [breakMinutes, setBreakMinutes] = useState<Record<string, number>>({});
  const [sessionNotes, setSessionNotes] = useState<Record<string, string>>({});
  const [clock, setClock] = useState(() => Date.now());

  const load = useCallback(async () => {
    setError(null);
    try {
      const next = await readOwnerLeverage();
      setSnapshot(next);
      setOperatorSlug((current) => current || next.operators[0]?.slug || "");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Owner leverage truth could not load.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!snapshot?.openSessions.length) return;
    const interval = window.setInterval(() => setClock(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, [snapshot?.openSessions.length]);

  async function mutate(payload: Record<string, unknown>) {
    setWorking(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/owner-leverage", {
        method: "POST",
        headers: getAdminRequestHeaders(),
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Owner leverage action failed.");
      }
      await load();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Owner leverage action failed.",
      );
    } finally {
      setWorking(false);
    }
  }

  const metrics = snapshot?.metrics;
  const band = metrics?.growthDayBand
    ? BAND_COPY[metrics.growthDayBand]
    : null;
  const selectedOperator = snapshot?.operators.find(
    (operator) => operator.slug === operatorSlug,
  );
  const buybackTarget = metrics?.nextBuybackTargetHours ?? 8;
  const headline = useMemo(() => {
    if (!metrics) return "Waiting for operating truth";
    if (metrics.today.independentJobs > 0) {
      return `${metrics.today.independentJobs} job${metrics.today.independentJobs === 1 ? "" : "s"} ran without Noah today`;
    }
    return "Make Noah optional to the next normal field day";
  }, [metrics]);

  return (
    <section
      aria-labelledby="owner-leverage-heading"
      className="mt-16 overflow-hidden rounded-[2rem] border border-violet-200/15 bg-[radial-gradient(circle_at_80%_5%,rgba(167,139,250,0.13),transparent_34%),linear-gradient(145deg,rgba(16,13,22,0.97),rgba(7,7,7,0.99))] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.34)] sm:p-8"
    >
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div className="max-w-3xl">
          <p className="text-[10px] uppercase tracking-[0.23em] text-violet-200/70">
            The next arena · owner leverage
          </p>
          <h2
            id="owner-leverage-heading"
            className="mt-3 font-serif text-3xl font-light text-[#f5f2eb] sm:text-5xl"
          >
            {headline}
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/48">
            Jarad produces. Noah and Dasan create demand. HomeAtlas counts only
            verified independence, exact Growth Hours, and signed attributed ARR.
          </p>
        </div>
        <div className="rounded-2xl border border-violet-200/15 bg-violet-200/[0.055] p-4 lg:min-w-[15rem]">
          <p className="text-[9px] uppercase tracking-[0.16em] text-violet-100/55">
            This week · next milestone
          </p>
          <p className="mt-2 font-serif text-4xl text-violet-100">
            {loading ? "…" : hours(metrics?.ownerFieldHoursBoughtBack ?? 0)}
            <span className="text-lg text-violet-100/45"> / {buybackTarget}h</span>
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-violet-200 transition-[width] duration-700"
              style={{ width: `${metrics?.buybackProgressPercent ?? 0}%` }}
            />
          </div>
        </div>
      </div>

      {error ? (
        <div className="mt-5 rounded-2xl border border-red-300/20 bg-red-300/[0.06] p-4 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      {snapshot && !snapshot.schemaAvailable ? (
        <div className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-300/[0.07] p-4 text-sm leading-relaxed text-amber-100/85">
          {snapshot.warnings[0] ?? "Owner leverage instrumentation is not ready."}
          The existing Growth page remains read-only and no data is being guessed.
        </div>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Field time bought back"
          value={hours(metrics?.ownerFieldHoursBoughtBack ?? 0)}
          detail={`${metrics?.independentJobs ?? 0} normal, documented, quality-verified job${metrics?.independentJobs === 1 ? "" : "s"} with zero owner involvement.`}
          accent
        />
        <Metric
          label="Growth Hours logged"
          value={hours(metrics?.growthHours ?? 0)}
          detail={`${metrics?.dedicatedGrowthDays ?? 0} dedicated day${metrics?.dedicatedGrowthDays === 1 ? "" : "s"}; a dedicated day requires at least four logged hours.`}
        />
        <Metric
          label="New attributed ARR"
          value={money(metrics?.newAttributedArr ?? 0)}
          detail={`${metrics?.membershipsClosed ?? 0} signed membership${metrics?.membershipsClosed === 1 ? "" : "s"}; unattributed sales are deliberately excluded.`}
        />
        <Metric
          label="ARR per Growth Hour"
          value={money(metrics?.newArrPerGrowthHour ?? null)}
          detail="Signed annual recurring value divided by completed Growth Hours—not cash collected or gross profit."
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/38">
                Operated without Noah · today
              </p>
              <p className="mt-2 font-serif text-2xl text-[#f5f2eb]">
                Three facts, no fake composite score
              </p>
            </div>
            {band ? (
              <span className={`rounded-full border px-3 py-1 text-[10px] ${band.className}`}>
                Weekly dedicated-day avg · {band.label}
              </span>
            ) : null}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Metric
              label="Independent jobs"
              value={String(metrics?.today.independentJobs ?? 0)}
              detail="Verified today"
            />
            <Metric
              label="Independent hours"
              value={hours(metrics?.today.independentProductionHours ?? 0)}
              detail="Normal production"
            />
            <Metric
              label="Owner interventions"
              value={String(metrics?.today.ownerInterventionJobs ?? 0)}
              detail="Explicitly recorded"
            />
            <Metric
              label="Growth Hours"
              value={hours(metrics?.today.growthHours ?? 0)}
              detail="Completed today"
            />
            <Metric
              label="New ARR"
              value={money(metrics?.today.newAttributedArr ?? 0)}
              detail="Signed + attributed"
            />
            <Metric
              label="ARR / growth day"
              value={money(metrics?.newArrPerDedicatedGrowthDay ?? null)}
              detail={`Floor ${money(NEW_ARR_PER_GROWTH_DAY.floor)} · target ${money(NEW_ARR_PER_GROWTH_DAY.target)}`}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/38">
            Growth Session clock
          </p>
          <h3 className="mt-2 font-serif text-2xl text-[#f5f2eb]">
            Turn bought-back time into demand
          </h3>

          {snapshot?.openSessions.map((session) => {
            const elapsedMinutes = Math.max(
              0,
              Math.round((clock - new Date(session.startedAt).getTime()) / 60_000),
            );
            return (
              <div
                key={session.id}
                className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.055] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-emerald-100">
                      {session.operatorName} · {CHANNEL_LABELS[session.channel]}
                    </p>
                    <p className="mt-1 text-xs text-emerald-100/55">
                      Started {time(session.startedAt)} · {hours(elapsedMinutes / 60)} running
                    </p>
                  </div>
                  <span className="rounded-full border border-emerald-200/25 px-3 py-1 text-[10px] text-emerald-100">
                    Live
                  </span>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <label className="text-[10px] text-white/45">
                    Break minutes
                    <input
                      type="number"
                      min={0}
                      max={240}
                      inputMode="numeric"
                      value={breakMinutes[session.id] ?? 0}
                      onChange={(event) =>
                        setBreakMinutes((current) => ({
                          ...current,
                          [session.id]: Number(event.target.value),
                        }))
                      }
                      className="mt-1.5 min-h-11 w-full rounded-xl border border-white/15 bg-[#111] px-3 text-sm text-white"
                    />
                  </label>
                  <label className="text-[10px] text-white/45">
                    Outcome note (optional)
                    <input
                      value={sessionNotes[session.id] ?? ""}
                      maxLength={2_000}
                      onChange={(event) =>
                        setSessionNotes((current) => ({
                          ...current,
                          [session.id]: event.target.value,
                        }))
                      }
                      placeholder="Doors, calls, follow-ups…"
                      className="mt-1.5 min-h-11 w-full rounded-xl border border-white/15 bg-[#111] px-3 text-sm text-white"
                    />
                  </label>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <Link
                    href={`/presentations/new?rep=${encodeURIComponent(session.operatorSlug)}`}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-accent/30 bg-accent/[0.08] px-3 text-xs font-medium text-accent"
                  >
                    New attributed presentation
                  </Link>
                  <button
                    type="button"
                    disabled={working}
                    onClick={() =>
                      void mutate({
                        action: "finish_growth_session",
                        sessionId: session.id,
                        breakMinutes: breakMinutes[session.id] ?? 0,
                        notes: sessionNotes[session.id] ?? "",
                      })
                    }
                    className="min-h-11 rounded-xl border border-emerald-200/30 bg-emerald-200/[0.08] px-3 text-xs text-emerald-100 disabled:opacity-40"
                  >
                    Finish + count time
                  </button>
                  <button
                    type="button"
                    disabled={working}
                    onClick={() =>
                      void mutate({
                        action: "cancel_growth_session",
                        sessionId: session.id,
                        notes: sessionNotes[session.id] ?? "",
                      })
                    }
                    className="min-h-11 rounded-xl border border-white/15 px-3 text-xs text-white/45 disabled:opacity-40"
                  >
                    Cancel session
                  </button>
                </div>
              </div>
            );
          })}

          {snapshot?.schemaAvailable ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-[10px] text-white/45">
                Growth operator
                <select
                  value={operatorSlug}
                  onChange={(event) => setOperatorSlug(event.target.value)}
                  className="mt-1.5 min-h-11 w-full rounded-xl border border-white/15 bg-[#111] px-3 text-sm text-white"
                >
                  {snapshot.operators.map((operator) => (
                    <option key={operator.id} value={operator.slug}>
                      {operator.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[10px] text-white/45">
                Channel
                <select
                  value={channel}
                  onChange={(event) => setChannel(event.target.value as GrowthChannel)}
                  className="mt-1.5 min-h-11 w-full rounded-xl border border-white/15 bg-[#111] px-3 text-sm text-white"
                >
                  {GROWTH_CHANNELS.map((value) => (
                    <option key={value} value={value}>
                      {CHANNEL_LABELS[value]}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={working || !selectedOperator}
                onClick={() =>
                  void mutate({
                    action: "start_growth_session",
                    operatorSlug,
                    channel,
                  })
                }
                className="min-h-12 rounded-xl border border-violet-200/30 bg-violet-200/[0.09] text-sm font-medium text-violet-100 disabled:opacity-40 sm:col-span-2"
              >
                {working
                  ? "Updating Growth Hours…"
                  : `Start ${selectedOperator?.displayName ?? "operator"}'s Growth Session`}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/38">
              Independence ladder
            </p>
            <h3 className="mt-2 font-serif text-2xl text-[#f5f2eb]">
              8 → 16 → 24 → 32 → off the tools
            </h3>
          </div>
          <Link
            href="/hq/today"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-4 text-xs text-white/65"
          >
            Review {snapshot?.unreviewedCompletedVisits ?? 0} completed visit
            {snapshot?.unreviewedCompletedVisits === 1 ? "" : "s"}
          </Link>
        </div>
        <div className="mt-5 grid grid-cols-4 gap-2">
          {OWNER_TIME_BUYBACK_LADDER_HOURS.map((target) => {
            const achieved = (metrics?.ownerFieldHoursBoughtBack ?? 0) >= target;
            return (
              <div
                key={target}
                className={`rounded-xl border p-3 text-center ${
                  achieved
                    ? "border-emerald-300/25 bg-emerald-300/[0.07] text-emerald-100"
                    : target === buybackTarget
                      ? "border-violet-200/30 bg-violet-200/[0.08] text-violet-100"
                      : "border-white/[0.08] text-white/30"
                }`}
              >
                <p className="font-serif text-2xl">{target}h</p>
                <p className="mt-1 text-[9px] uppercase tracking-[0.12em]">
                  {achieved ? "earned" : target === buybackTarget ? "next" : "locked"}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Metric
            label="Leads created"
            value={String(metrics?.leadsCreated ?? 0)}
            detail="Owner-attributed pipeline"
          />
          <Metric
            label="Presentations"
            value={String(metrics?.presentationsStarted ?? 0)}
            detail="Started this week"
          />
          <Metric
            label="Memberships closed"
            value={String(metrics?.membershipsClosed ?? 0)}
            detail="Signed attribution"
          />
          <Metric
            label="Cohort close rate"
            value={percent(metrics?.presentationCloseRate ?? null)}
            detail="This week's presentations"
          />
          <Metric
            label="Quality exceptions"
            value={String(metrics?.qualityExceptionJobs ?? 0)}
            detail={`${metrics?.ownerInterventionJobs ?? 0} owner-assisted job${metrics?.ownerInterventionJobs === 1 ? "" : "s"}`}
          />
        </div>

        {metrics?.technicianBreakdown.length ? (
          <div className="mt-5 border-t border-white/[0.08] pt-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/38">
              Independent production by technician
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {metrics.technicianBreakdown.map((technician) => (
                <span
                  key={technician.technicianJobberUserId}
                  className="rounded-full border border-emerald-300/20 bg-emerald-300/[0.055] px-3 py-1.5 text-xs text-emerald-100/80"
                >
                  {technician.technicianDisplayName} · {technician.jobs} job
                  {technician.jobs === 1 ? "" : "s"} · {hours(technician.minutes / 60)}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {snapshot?.warnings.length ? (
        <div className="mt-5 space-y-1 text-[11px] leading-relaxed text-amber-100/55">
          {snapshot.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}
    </section>
  );
}
