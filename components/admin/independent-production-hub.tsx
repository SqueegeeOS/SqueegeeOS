"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { HqFounderNav } from "@/components/admin/hq-founder-nav";
import { AmbientStage } from "@/components/craft/ambient-stage";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import { useAdminUnlockedState } from "@/lib/admin/use-admin-unlocked-state";
import {
  TYLER_GERMANY_TECHNICIAN_ID,
  type TechnicianOperationalProfile,
} from "@/lib/field-operations/technician-profile";

function hours(minutes: number): string {
  const value = minutes / 60;
  return `${value.toFixed(value >= 10 ? 1 : 2)}h`;
}

function money(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4 sm:p-5">
      <p className="text-[9px] uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-2 font-serif text-3xl font-light text-foreground">{value}</p>
      <p className="mt-2 text-xs leading-relaxed text-muted">{detail}</p>
    </article>
  );
}

export function IndependentProductionHub() {
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
        `/api/admin/technicians/${TYLER_GERMANY_TECHNICIAN_ID}/profile`,
        { headers: getAdminRequestHeaders(), cache: "no-store" },
      );
      const body = (await response.json().catch(() => null)) as
        | { profile?: TechnicianOperationalProfile; error?: string }
        | null;
      if (!response.ok || !body?.profile) {
        throw new Error(body?.error ?? "Independent production truth could not load.");
      }
      setProfile(body.profile);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Independent production truth could not load.",
      );
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

  const activity = profile?.activity;
  const integrity = profile?.workdayIntegrity;

  return (
    <AmbientStage className="min-h-screen text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-5 pb-24 sm:px-6 sm:py-7">
        <HqFounderNav />

        <header className="mt-9 overflow-hidden rounded-[2rem] border border-accent/20 bg-[radial-gradient(circle_at_85%_10%,rgba(201,184,150,.14),transparent_35%),linear-gradient(145deg,rgba(18,17,14,.97),rgba(7,7,7,.99))] p-6 sm:p-9">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-success/30 bg-success/[0.08] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-success">
                  Independent production · live
                </span>
                <span className="rounded-full border border-accent/25 bg-accent/[0.06] px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-accent">
                  Full-time technician
                </span>
              </div>
              <h1 className="mt-5 font-serif text-4xl font-light tracking-[-0.04em] sm:text-6xl">
                Tyler produces. Sales keeps feeding the route.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
                The independence experiment is over. Tyler Germany is the Lead Technician and the operating job now is utilization, quality, clean evidence, and enough demand to keep production moving without pulling founders back onto the tools.
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
          <p role="alert" className="mt-5 rounded-2xl border border-warning/25 bg-warning/[0.07] p-4 text-sm text-warning">
            {error}
          </p>
        ) : null}

        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric
            label="Jobs today"
            value={`${activity?.todayAssignments ?? 0}`}
            detail={`${activity?.todayCloseouts ?? 0} closeout${activity?.todayCloseouts === 1 ? "" : "s"} saved today.`}
          />
          <Metric
            label="Recorded labor"
            value={hours(activity?.todayRecordedMinutes ?? 0)}
            detail={`${hours(activity?.todayClockedMinutes ?? 0)} verified clock + ${hours(activity?.todayManualMinutes ?? 0)} audited owner-entered.`}
          />
          <Metric
            label="Workday integrity"
            value={`${integrity?.percent ?? 0}%`}
            detail="Jobber sync, closeout, labor evidence, before photo, and after photo."
          />
          <Metric
            label="Live-dispatch value"
            value={money(activity?.liveSoldAmountCentsToday ?? 0)}
            detail={`${activity?.pendingSyncJobs ?? 0} same-day job${activity?.pendingSyncJobs === 1 ? "" : "s"} still waiting on Jobber reconciliation.`}
          />
        </section>

        <section className="mt-7 rounded-[2rem] border border-foreground/10 bg-surface-elevated p-5 sm:p-7">
          <p className="text-[10px] uppercase tracking-[0.2em] text-accent">The operating loop</p>
          <h2 className="mt-2 text-2xl font-semibold">Sell → dispatch → produce → remember.</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["1 · Sell", "Put the customer and schedule in Jobber first. Keep the CRM maintained while you knock."],
              ["2 · Feed Tyler", "Use Atlas Quick Dispatch for same-day work. Minimal second entry; reconciliation can happen later."],
              ["3 · Produce", "Tyler clocks, completes scope, and captures before/after proof from Field Run."],
              ["4 · Compound", "Hours, closeout, photos, issues, and property memory accumulate in Atlas automatically."],
            ].map(([title, detail]) => (
              <article key={title} className="rounded-2xl border border-foreground/10 bg-background/35 p-4">
                <p className="text-sm font-medium text-foreground">{title}</p>
                <p className="mt-2 text-xs leading-relaxed text-muted">{detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href={`/hq/technicians/${TYLER_GERMANY_TECHNICIAN_ID}`}
            className="rounded-2xl border border-accent/25 bg-accent/[0.06] p-5 transition hover:border-accent/45"
          >
            <p className="text-sm font-semibold text-accent">Tyler backend →</p>
            <p className="mt-2 text-xs leading-relaxed text-muted">Hours, jobs, proof, photo memory, live dispatch, integrity, and capacity.</p>
          </Link>
          <Link href="/hq/dispatch" className="rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-5">
            <p className="text-sm font-semibold">Dispatch →</p>
            <p className="mt-2 text-xs leading-relaxed text-muted">See the route and move work where it needs to go.</p>
          </Link>
          <Link href="/hq/today" className="rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-5">
            <p className="text-sm font-semibold">Today →</p>
            <p className="mt-2 text-xs leading-relaxed text-muted">Owner view of live field production and service proof.</p>
          </Link>
          <Link href="/hq/technicians/access" className="rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-5">
            <p className="text-sm font-semibold">Access & training archive →</p>
            <p className="mt-2 text-xs leading-relaxed text-muted">Field Pass controls, capacity planning, and the old readiness evidence tools when you actually need them.</p>
          </Link>
        </section>

        <p className="mt-6 text-xs leading-relaxed text-muted">
          Tyler&apos;s old readiness ledger is retained as quality evidence, not as a gate on whether he is allowed to work independently.
        </p>
      </div>
    </AmbientStage>
  );
}
