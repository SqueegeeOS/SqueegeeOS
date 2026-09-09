"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { HqFounderNav } from "@/components/admin/hq-founder-nav";
import { AmbientStage } from "@/components/craft/ambient-stage";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import type { GrowthTruthSnapshot } from "@/lib/admin/growth-command-center";
import type { OwnerLeverageSnapshot } from "@/lib/admin/owner-leverage";
import { useAdminUnlockedState } from "@/lib/admin/use-admin-unlocked-state";
import { TYLER_GERMANY_TECHNICIAN_ID } from "@/lib/field-operations/technician-profile";

function money(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function hours(value: number | null): string {
  if (value == null) return "—";
  return `${value.toFixed(value >= 10 ? 1 : 2)}h`;
}

function Metric({ label, value, detail, accent = false }: {
  label: string;
  value: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <article className={`rounded-2xl border p-4 sm:p-5 ${accent ? "border-accent/25 bg-accent/[0.06]" : "border-foreground/10 bg-foreground/[0.035]"}`}>
      <p className="text-[9px] uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className={`mt-2 font-serif text-3xl font-light ${accent ? "text-accent" : "text-foreground"}`}>{value}</p>
      <p className="mt-2 text-xs leading-relaxed text-muted">{detail}</p>
    </article>
  );
}

export function GrowthOperatingLoopPage() {
  const [unlocked, setUnlocked] = useAdminUnlockedState();
  const [growth, setGrowth] = useState<GrowthTruthSnapshot | null>(null);
  const [leverage, setLeverage] = useState<OwnerLeverageSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!unlocked) return;
    setLoading(true);
    setError(null);
    try {
      const [growthResponse, leverageResponse] = await Promise.all([
        fetch("/api/admin/growth", {
          headers: getAdminRequestHeaders(),
          cache: "no-store",
        }),
        fetch("/api/admin/owner-leverage", {
          headers: getAdminRequestHeaders(),
          cache: "no-store",
        }),
      ]);
      const growthBody = (await growthResponse.json().catch(() => null)) as
        | (GrowthTruthSnapshot & { error?: string })
        | { error?: string }
        | null;
      const leverageBody = (await leverageResponse.json().catch(() => null)) as
        | (OwnerLeverageSnapshot & { error?: string })
        | { error?: string }
        | null;
      if (!growthResponse.ok || !growthBody || !("currentActiveArr" in growthBody)) {
        throw new Error(growthBody?.error ?? "Growth truth could not load.");
      }
      setGrowth(growthBody);
      if (leverageResponse.ok && leverageBody && "metrics" in leverageBody) {
        setLeverage(leverageBody);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Growth truth could not load.");
    } finally {
      setLoading(false);
    }
  }, [unlocked]);

  useEffect(() => {
    if (!unlocked) return;
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load, unlocked]);

  if (!unlocked) return <AdminPinGate onUnlock={() => setUnlocked(true)} />;

  const metrics = leverage?.metrics;

  return (
    <AmbientStage className="min-h-screen text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-5 pb-24 sm:px-6 sm:py-7">
        <HqFounderNav />

        <header className="mt-9 overflow-hidden rounded-[2rem] border border-success/20 bg-[radial-gradient(circle_at_85%_10%,rgba(110,231,183,.12),transparent_34%),linear-gradient(145deg,rgba(14,18,15,.97),rgba(7,7,7,.99))] p-6 sm:p-9">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[10px] uppercase tracking-[0.24em] text-success/80">The next arena · growth engine</p>
              <h1 className="mt-4 font-serif text-4xl font-light tracking-[-0.04em] sm:text-6xl">
                Sell while Tyler produces. Then do it again.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
                You already proved independent production works. Headquarters now optimizes the machine: keep Tyler utilized, turn founder and sales-team time into demand, convert the best customers to recurring HomeAtlas care, and add capacity before the route breaks.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="min-h-11 rounded-full border border-foreground/15 px-4 text-xs text-muted disabled:opacity-50"
            >
              {loading ? "Refreshing…" : "Refresh truth"}
            </button>
          </div>
        </header>

        {error ? (
          <p role="alert" className="mt-5 rounded-2xl border border-warning/25 bg-warning/[0.07] p-4 text-sm text-warning">{error}</p>
        ) : null}

        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Active ARR" value={money(growth?.currentActiveArr ?? 0)} detail="Active recurring membership run-rate." accent />
          <Metric label="ARR added · 30d" value={money(growth?.arrAddedLast30Days ?? 0)} detail={`${growth?.signedMembersLast30Days ?? 0} membership${growth?.signedMembersLast30Days === 1 ? "" : "s"} signed in the trailing 30 days.`} accent />
          <Metric label="Independent production" value={hours(metrics?.independentProductionHours ?? 0)} detail={`${metrics?.independentJobs ?? 0} quality-verified job${metrics?.independentJobs === 1 ? "" : "s"} recorded without owner intervention.`} />
          <Metric label="ARR / Growth Hour" value={money(metrics?.newArrPerGrowthHour ?? null)} detail={`${hours(metrics?.growthHours ?? 0)} deliberate Growth Hours logged this week.`} />
        </section>

        <section className="mt-7 rounded-[2rem] border border-foreground/10 bg-surface-elevated p-5 sm:p-7">
          <p className="text-[10px] uppercase tracking-[0.2em] text-accent">Current operating doctrine</p>
          <h2 className="mt-2 text-2xl font-semibold">Jobber stays maintained. Atlas makes the handoff fast.</h2>
          <div className="mt-5 grid gap-3 lg:grid-cols-5">
            {[
              ["Demand", "Noah, Dasan, David, Google, ads, referrals, and reactivation create work."],
              ["CRM", "Close the customer and schedule in Jobber first so the business record stays clean."],
              ["Dispatch", "For same-day D2D work, Quick Dispatch it to Tyler in Atlas with almost no second entry."],
              ["Production", "Tyler runs the work independently and records time, scope, issues, and before/after proof."],
              ["Memory", "Atlas turns each visit into property history and member value instead of losing the evidence in a job ticket."],
            ].map(([title, detail]) => (
              <article key={title} className="rounded-2xl border border-foreground/10 bg-background/35 p-4">
                <p className="text-sm font-medium">{title}</p>
                <p className="mt-2 text-xs leading-relaxed text-muted">{detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-7 grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-[2rem] border border-foreground/10 bg-surface-elevated p-5 sm:p-7">
            <p className="text-[10px] uppercase tracking-[0.2em] text-success">What wins now</p>
            <div className="mt-4 space-y-3">
              {[
                ["Keep Tyler full", "Watch same-day gaps and upcoming capacity. Sell into open production without creating sloppy routing."],
                ["Raise valuable sales time", "Track what channels actually create signed ARR, not just doors knocked or quotes sent."],
                ["Densify recurring work", "Prefer membership and repeatable care that makes routes denser and future revenue more predictable."],
                ["Protect the standard", "Before/after photos, closeouts, clock evidence, follow-ups, and callbacks should get cleaner as volume rises."],
                ["Add capacity before pain", "The next staffing question is not whether one tech can work alone; it is when a second production seat earns its keep."],
              ].map(([title, detail], index) => (
                <article key={title} className="flex gap-4 rounded-2xl border border-foreground/10 bg-background/30 p-4">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-success/25 bg-success/[0.07] text-xs font-semibold text-success">{index + 1}</span>
                  <div>
                    <p className="text-sm font-medium">{title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted">{detail}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Link href={`/hq/technicians/${TYLER_GERMANY_TECHNICIAN_ID}`} className="block rounded-2xl border border-success/25 bg-success/[0.06] p-5">
              <p className="text-sm font-semibold text-success">Tyler production →</p>
              <p className="mt-2 text-xs leading-relaxed text-muted">Live jobs, labor, proof, utilization, photo memory, and capacity.</p>
            </Link>
            <Link href="/hq/sales" className="block rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-5">
              <p className="text-sm font-semibold">Sales →</p>
              <p className="mt-2 text-xs leading-relaxed text-muted">Pipeline, ownership, next actions, presentations, and signed handoffs.</p>
            </Link>
            <Link href="/hq/dispatch" className="block rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-5">
              <p className="text-sm font-semibold">Dispatch →</p>
              <p className="mt-2 text-xs leading-relaxed text-muted">Keep today and the next route balanced as sales creates more work.</p>
            </Link>
            <Link href="/hq/growth/planning" className="block rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-5">
              <p className="text-sm font-semibold">Planning lab →</p>
              <p className="mt-2 text-xs leading-relaxed text-muted">Old buyback ladder, ARR scenario model, detailed readiness-era planning, and long-range experiments.</p>
            </Link>
          </div>
        </section>
      </div>
    </AmbientStage>
  );
}
