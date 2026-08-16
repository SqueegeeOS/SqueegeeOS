"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { HqFounderNav } from "@/components/admin/hq-founder-nav";
import { OwnerLeverageScoreboard } from "@/components/admin/owner-leverage-scoreboard";
import { AmbientStage } from "@/components/craft/ambient-stage";
import { MotionReveal } from "@/components/craft/motion-reveal";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import {
  GROWTH_INITIATIVES,
  GROWTH_LADDER,
  GROWTH_TARGET_ARR,
  GROWTH_TARGET_DATE,
  LONG_TERM_ARR_VISION,
  calculateGrowthScenario,
  type GrowthInitiativeHorizon,
  type GrowthTruthSnapshot,
} from "@/lib/admin/growth-command-center";
import { useAdminUnlockedState } from "@/lib/admin/use-admin-unlocked-state";
import { ROUTES } from "@/lib/navigation/config";

function money(value: number, compact = false): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    notation: compact ? "compact" : "standard",
  }).format(value);
}

function number(value: number, digits = 1): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
  }).format(value);
}

function percent(value: number | null): string {
  return value == null ? "Unknown" : `${number(value, 1)}%`;
}

function Field({
  label,
  value,
  suffix,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  suffix?: string;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block rounded-2xl border border-white/[0.08] bg-black/20 p-4">
      <span className="text-[10px] uppercase tracking-[0.16em] text-white/40">
        {label}
      </span>
      <span className="mt-2 flex items-baseline gap-2">
        <input
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) onChange(next);
          }}
          className="min-w-0 flex-1 bg-transparent font-serif text-2xl text-[#f5f2eb] outline-none"
        />
        {suffix ? <span className="text-xs text-white/35">{suffix}</span> : null}
      </span>
    </label>
  );
}

function TruthCard({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <article className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
      <p className="text-[10px] uppercase tracking-[0.16em] text-white/38">{label}</p>
      <p
        className={`mt-2 font-serif text-3xl font-light tabular-nums ${
          accent ? "text-accent" : "text-[#f5f2eb]"
        }`}
      >
        {value}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-white/38">{hint}</p>
    </article>
  );
}

const ITINERARY = [
  {
    cadence: "Every field day",
    title: "Make normal production owner-optional",
    steps: [
      "Give Jarad the verified scope, access notes, route stage, and property memory before arrival.",
      "Require closeout proof and record owner help or a true exception—never rely on memory.",
      "Count bought-back time only after a normal visit passes the independence gate.",
    ],
  },
  {
    cadence: "Every Growth Day",
    title: "Turn bought-back time into recurring demand",
    steps: [
      "Start a Growth Session for Noah or Dasan and choose the channel before doing the work.",
      "Use the operator-linked presentation path so a signed agreement owns its ARR attribution.",
      "Finish the session with exact break time and a short outcome note.",
    ],
  },
  {
    cadence: "Every week",
    title: "Advance the 8 → 16 → 24 → 32 ladder",
    steps: [
      "Review independent hours, owner interventions, quality exceptions, Growth Hours, and signed ARR.",
      "Coach the repeated exception; do not punish the technician for surfacing a real risk.",
      "When demand outruns capacity, train or hire production instead of defaulting Noah to the tools.",
    ],
  },
] as const;

function GrowthContent() {
  const [snapshot, setSnapshot] = useState<GrowthTruthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [averageMemberArr, setAverageMemberArr] = useState(1_200);
  const [leadsPerWeek, setLeadsPerWeek] = useState(10);
  const [closeRate, setCloseRate] = useState(25);
  const [retention, setRetention] = useState(90);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/growth", {
        headers: getAdminRequestHeaders(),
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as
        | GrowthTruthSnapshot
        | { error?: string }
        | null;
      if (!response.ok || !body || !("source" in body)) {
        throw new Error(body && "error" in body ? body.error : "Growth truth could not load.");
      }
      setSnapshot(body);
      if (body.averageMemberArr && body.averageMemberArr > 0) {
        setAverageMemberArr(Math.round(body.averageMemberArr));
      }
      if (body.directionalCloseRate != null && body.leadsLast30Days >= 5) {
        setCloseRate(Math.max(5, Math.min(80, Math.round(body.directionalCloseRate))));
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Growth truth could not load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const scenario = useMemo(
    () =>
      calculateGrowthScenario({
        currentArr: snapshot?.currentActiveArr ?? 0,
        targetArr: GROWTH_TARGET_ARR,
        targetDate: GROWTH_TARGET_DATE,
        averageMemberArr,
        leadsPerWeek,
        closeRatePercent: closeRate,
        annualRetentionPercent: retention,
      }),
    [averageMemberArr, closeRate, leadsPerWeek, retention, snapshot?.currentActiveArr],
  );

  const currentProgress = Math.min(
    100,
    ((snapshot?.currentActiveArr ?? 0) / GROWTH_TARGET_ARR) * 100,
  );
  const sourceLabel = snapshot?.source === "supabase" ? "Live Supabase truth" : "Data unavailable";

  return (
    <AmbientStage className="min-h-screen px-4 py-8 text-foreground sm:px-6 sm:py-12">
      <div className="relative mx-auto max-w-6xl">
        <HqFounderNav />

        <MotionReveal className="mt-10 overflow-hidden rounded-[2rem] border border-accent/15 bg-[radial-gradient(circle_at_80%_15%,rgba(201,184,150,0.14),transparent_34%),linear-gradient(145deg,rgba(20,18,14,0.96),rgba(7,7,7,0.98))] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.36)] sm:p-9">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] uppercase tracking-[0.25em] text-accent/70">
                  Growth Command Center
                </p>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[9px] uppercase tracking-[0.12em] text-white/38">
                  {sourceLabel}
                </span>
              </div>
              <h1 className="mt-4 font-serif text-4xl font-light leading-[1.02] text-[#f5f2eb] sm:text-6xl">
                The path to {money(GROWTH_TARGET_ARR, true)} ARR.
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-relaxed text-white/52 sm:text-base">
                Jarad produces. Noah and Dasan create demand. HomeAtlas coordinates
                the handoff and separates verified company truth from planning assumptions.
              </p>
            </div>
            <div className="min-w-[15rem] rounded-2xl border border-accent/15 bg-accent/[0.055] p-5">
              <p className="text-[10px] uppercase tracking-[0.16em] text-accent/65">
                Active recurring ARR
              </p>
              <p className="mt-2 font-serif text-4xl text-accent">
                {loading ? "..." : money(snapshot?.currentActiveArr ?? 0)}
              </p>
              <p className="mt-2 text-xs text-white/38">
                {number(currentProgress, 1)}% of the Dec 2028 target
              </p>
            </div>
          </div>
          <div className="mt-8 h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent/60 via-accent to-[#f6e7bc] shadow-[0_0_22px_rgba(201,184,150,0.3)] transition-[width] duration-700"
              style={{ width: `${currentProgress}%` }}
            />
          </div>
        </MotionReveal>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/[0.06] p-4 text-sm text-red-200">
            {error} <button onClick={() => void load()} className="ml-2 underline">Try again</button>
          </div>
        ) : null}

        <section className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-accent/65">Company truth</p>
              <h2 className="mt-2 font-serif text-3xl text-[#f5f2eb]">What is real right now</h2>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/55 transition hover:border-accent/30 hover:text-accent disabled:opacity-40"
            >
              {loading ? "Refreshing..." : "Refresh truth"}
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <TruthCard
              label="Active ARR"
              value={money(snapshot?.currentActiveArr ?? 0)}
              hint="Strict active memberships; primary operating metric."
              accent
            />
            <TruthCard
              label="On-book ARR"
              value={money(snapshot?.onBookArr ?? 0)}
              hint="Signed and not cancelled, including activation still in progress."
            />
            <TruthCard
              label="ARR added / 30 days"
              value={money(snapshot?.arrAddedLast30Days ?? 0)}
              hint="Annual value of memberships signed in the trailing 30 days."
            />
            <TruthCard
              label="Members"
              value={`${snapshot?.activeMembers ?? 0} active / ${snapshot?.membersOnBook ?? 0} on book`}
              hint={`${snapshot?.cardOnFileCount ?? 0} currently have a card on file.`}
            />
            <TruthCard
              label="Lead flow / 30 days"
              value={`${snapshot?.leadsLast30Days ?? 0} leads`}
              hint={`${snapshot?.sourceMix.website ?? 0} website or direct, ${snapshot?.sourceMix.facebook ?? 0} Facebook.`}
            />
            <TruthCard
              label="Directional close rate"
              value={percent(snapshot?.directionalCloseRate ?? null)}
              hint={`${snapshot?.signedMembersLast30Days ?? 0} signed members; not yet cohort-matched.`}
            />
          </div>

          {snapshot?.warnings.map((warning) => (
            <p key={warning} className="mt-3 text-xs leading-relaxed text-amber-200/55">
              {warning}
            </p>
          ))}
        </section>

        <OwnerLeverageScoreboard />

        <section className="mt-16 rounded-[2rem] border border-white/[0.08] bg-[#0d0c0a]/85 p-5 sm:p-8">
          <div className="grid gap-8 xl:grid-cols-[0.85fr_1.15fr]">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-accent/65">Adjustable scenario</p>
              <h2 className="mt-2 font-serif text-3xl text-[#f5f2eb]">What the inputs could produce</h2>
              <p className="mt-3 text-sm leading-relaxed text-white/45">
                These are assumptions, not promises. Change them until the operating pace feels demanding but believable.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <Field label="Average member ARR" value={averageMemberArr} suffix="per member" min={100} max={20_000} step={50} onChange={setAverageMemberArr} />
                <Field label="Qualified leads" value={leadsPerWeek} suffix="per week" min={0} max={500} onChange={setLeadsPerWeek} />
                <Field label="Close rate" value={closeRate} suffix="percent" min={0} max={100} onChange={setCloseRate} />
                <Field label="Annual retention" value={retention} suffix="percent" min={0} max={100} onChange={setRetention} />
              </div>
            </div>

            <div className="rounded-[1.6rem] border border-accent/15 bg-[radial-gradient(circle_at_75%_10%,rgba(201,184,150,0.11),transparent_36%),rgba(0,0,0,0.22)] p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/38">Modeled ARR at Dec 2028</p>
                  <p className={`mt-2 font-serif text-4xl sm:text-5xl ${scenario.onTrack ? "text-emerald-300" : "text-accent"}`}>
                    {money(scenario.projectedArrAtTargetDate)}
                  </p>
                </div>
                <span className={`rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] ${scenario.onTrack ? "border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-200" : "border-amber-300/20 bg-amber-300/[0.06] text-amber-200"}`}>
                  {scenario.onTrack ? "Modeled on track" : "Pace needs work"}
                </span>
              </div>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <TruthCard label="Time remaining" value={`${scenario.monthsRemaining} months`} hint="From today through the target month." />
                <TruthCard label="ARR gap" value={money(scenario.arrGap)} hint="Gap from strict active ARR to target." />
                <TruthCard label="Required net pace" value={`${money(scenario.requiredNetArrPerMonth)}/mo`} hint={`${number(scenario.requiredMembersPerMonth, 1)} average new members per month before extra churn.`} accent />
                <TruthCard label="Lead pace required" value={`${number(scenario.requiredLeadsPerWeek, 1)}/week`} hint={`At the chosen ${number(closeRate, 0)}% close rate and ${money(averageMemberArr)} average ARR.`} />
                <TruthCard label="Modeled closes" value={`${number(scenario.modeledMembersPerMonth, 1)}/mo`} hint="From your qualified-lead and close-rate inputs." />
                <TruthCard label="Modeled new ARR" value={`${money(scenario.modeledNewArrPerMonth)}/mo`} hint="Gross new ARR before modeled retention loss." />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-16">
          <p className="text-[10px] uppercase tracking-[0.22em] text-accent/65">Operating itinerary</p>
          <h2 className="mt-2 font-serif text-3xl text-[#f5f2eb]">The repeatable founder cadence</h2>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {ITINERARY.map((block, index) => (
              <article key={block.cadence} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
                <p className="text-[10px] uppercase tracking-[0.16em] text-accent/60">0{index + 1} / {block.cadence}</p>
                <h3 className="mt-3 font-serif text-xl text-[#f5f2eb]">{block.title}</h3>
                <ol className="mt-4 space-y-3 text-sm leading-relaxed text-white/48">
                  {block.steps.map((step) => <li key={step}>{step}</li>)}
                </ol>
              </article>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={ROUTES.newPresentation} className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-black">Activate a customer</Link>
            <Link href={ROUTES.hqPendingRequests} className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/55 hover:text-white">Open leads</Link>
            <Link href={ROUTES.hqCommunications} className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/55 hover:text-white">Open conversations</Link>
            <Link href={ROUTES.hqBilling} className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/55 hover:text-white">Billing readiness</Link>
          </div>
        </section>

        <section className="mt-16">
          <p className="text-[10px] uppercase tracking-[0.22em] text-accent/65">Execution backlog</p>
          <h2 className="mt-2 font-serif text-3xl text-[#f5f2eb]">20 moves, deliberately sequenced</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/45">
            The order protects the fragile 0-to-10-member stage. Reliability and conversion come before heavy automation or expansion.
          </p>
          <div className="mt-7 grid gap-5 lg:grid-cols-3">
            {(["now", "next", "later"] as GrowthInitiativeHorizon[]).map((horizon) => (
              <div key={horizon}>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">{horizon}</h3>
                  <span className="text-[10px] text-white/30">{GROWTH_INITIATIVES.filter((item) => item.horizon === horizon).length} moves</span>
                </div>
                <div className="space-y-3">
                  {GROWTH_INITIATIVES.filter((item) => item.horizon === horizon).map((item, index) => (
                    <article key={item.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
                      <div className="flex items-center justify-between gap-3 text-[9px] uppercase tracking-[0.13em]">
                        <span className="text-white/28">{String(index + 1).padStart(2, "0")}</span>
                        <span className={item.impact === "Critical" ? "text-amber-200/70" : "text-white/35"}>{item.impact}</span>
                      </div>
                      <h4 className="mt-2 text-sm font-medium text-[#f5f2eb]">{item.title}</h4>
                      <p className="mt-2 text-xs leading-relaxed text-white/42">{item.outcome}</p>
                      <p className="mt-3 text-[9px] uppercase tracking-[0.13em] text-accent/50">Owner: {item.owner}</p>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-20 mt-16 rounded-[2rem] border border-accent/15 bg-accent/[0.04] p-5 sm:p-8">
          <p className="text-[10px] uppercase tracking-[0.22em] text-accent/65">Long-term architecture</p>
          <h2 className="mt-2 font-serif text-3xl text-[#f5f2eb]">How a {money(LONG_TERM_ARR_VISION, true)} company gets built</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/45">
            Each layer earns the right to add the next. The software should make disciplined actions easier; it cannot substitute for demand, service quality, unit economics, or leadership.
          </p>
          <div className="mt-7 grid gap-3 lg:grid-cols-5">
            {GROWTH_LADDER.map((stage, index) => (
              <article key={stage.range} className="rounded-2xl border border-white/[0.08] bg-black/20 p-4">
                <p className="text-[9px] uppercase tracking-[0.14em] text-accent/55">Stage {index + 1} / {stage.range}</p>
                <h3 className="mt-3 font-serif text-lg text-[#f5f2eb]">{stage.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-white/42">{stage.focus}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </AmbientStage>
  );
}

export function GrowthCommandCenterPage() {
  const [unlocked, setUnlocked] = useAdminUnlockedState();
  if (!unlocked) return <AdminPinGate onUnlock={() => setUnlocked(true)} />;
  return <GrowthContent />;
}
