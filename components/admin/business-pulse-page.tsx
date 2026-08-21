"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { HqFounderNav } from "@/components/admin/hq-founder-nav";
import { AmbientStage } from "@/components/craft/ambient-stage";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import {
  BUSINESS_PULSE_PERIODS,
  type BusinessPulsePeriod,
  type BusinessPulseSnapshot,
  type BusinessPulseSourceHealth,
} from "@/lib/admin/business-pulse";
import { useAdminUnlockedState } from "@/lib/admin/use-admin-unlocked-state";

function money(cents: number, compact = false): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    notation: compact ? "compact" : "standard",
  }).format(cents / 100);
}

function dateTime(value: string | null): string {
  if (!value) return "No event recorded";
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
    timeZoneName: "short",
  }).format(instant);
}

function SourceCard({ source }: { source: BusinessPulseSourceHealth }) {
  const tone =
    source.status === "healthy"
      ? "bg-emerald-300"
      : source.status === "attention"
        ? "bg-amber-300"
        : source.status === "idle"
          ? "bg-sky-300"
          : "bg-white/25";
  const label = source.status.replace("_", " ");
  return (
    <article className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[#f5f2eb]">{source.label}</p>
        <span className="inline-flex items-center gap-2 text-[9px] uppercase tracking-[0.14em] text-white/42">
          <span className={`h-2 w-2 rounded-full ${tone}`} />
          {label}
        </span>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-white/42">{source.detail}</p>
      <p className="mt-3 text-[10px] text-white/28">
        {source.lastEventAt ? `Last event ${dateTime(source.lastEventAt)}` : "No event yet"}
      </p>
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
  value: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <article className="rounded-[1.45rem] border border-white/[0.08] bg-[linear-gradient(145deg,rgba(255,255,255,0.035),rgba(255,255,255,0.012))] p-5">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/38">{label}</p>
      <p
        className={`mt-2 font-serif text-3xl font-light tabular-nums sm:text-4xl ${accent ? "text-accent" : "text-[#f5f2eb]"}`}
      >
        {value}
      </p>
      <p className="mt-3 text-xs leading-relaxed text-white/38">{detail}</p>
    </article>
  );
}

function PulseContent() {
  const [period, setPeriod] = useState<BusinessPulsePeriod>("current_month");
  const [snapshot, setSnapshot] = useState<BusinessPulseSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/business-pulse?period=${period}`, {
        headers: getAdminRequestHeaders(),
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as
        | BusinessPulseSnapshot
        | { error?: string }
        | null;
      if (!response.ok || !body || !("metrics" in body)) {
        throw new Error(body && "error" in body ? body.error : "Business Pulse could not load.");
      }
      setSnapshot(body);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Business Pulse could not load.");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    const kickoff = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(kickoff);
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const syncJobber = useCallback(async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const response = await fetch("/api/admin/care-operations/jobber/sync", {
        method: "POST",
        headers: getAdminRequestHeaders(),
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error || "Jobber sync did not finish.");
      }
      setSyncMessage("Jobber refreshed. Business Pulse is using the latest stored snapshot.");
      await load();
    } catch (syncError) {
      setSyncMessage(
        syncError instanceof Error ? syncError.message : "Jobber sync did not finish.",
      );
    } finally {
      setSyncing(false);
    }
  }, [load]);

  const metrics = snapshot?.metrics;
  const jobCoverage = metrics?.jobsBooked
    ? Math.round((metrics.classifiedJobs / metrics.jobsBooked) * 100)
    : 100;

  return (
    <AmbientStage className="min-h-screen px-4 py-8 text-foreground sm:px-6 sm:py-12">
      <div className="relative mx-auto max-w-7xl">
        <HqFounderNav />

        <header className="mt-10 overflow-hidden rounded-[2rem] border border-accent/15 bg-[radial-gradient(circle_at_82%_12%,rgba(201,184,150,0.16),transparent_34%),linear-gradient(145deg,rgba(20,18,14,0.97),rgba(6,6,6,0.99))] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.38)] sm:p-9">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[10px] uppercase tracking-[0.26em] text-accent/70">
                Business Pulse
              </p>
              <h1 className="mt-4 font-serif text-4xl font-light leading-[1.02] text-[#f5f2eb] sm:text-6xl">
                Every important number. One honest view.
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-relaxed text-white/52 sm:text-base">
                Jobber measures the work. Stripe confirms HomeAtlas collections.
                HomeAtlas owns membership ARR and customer identity. Nothing is silently
                counted twice.
              </p>
            </div>
            <div className="rounded-2xl border border-accent/15 bg-accent/[0.055] p-5 lg:min-w-[18rem]">
              <p className="text-[10px] uppercase tracking-[0.16em] text-accent/65">
                Paid work value · {snapshot?.range.label ?? "period"}
              </p>
              <p className="mt-2 font-serif text-4xl text-accent">
                {loading ? "…" : money(metrics?.paidWorkValueCents ?? 0)}
              </p>
              <p className="mt-2 text-xs text-white/38">
                {metrics?.jobsMarkedPaid ?? 0} unique Jobber jobs marked paid
              </p>
            </div>
          </div>
        </header>

        <section className="mt-6 flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {BUSINESS_PULSE_PERIODS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPeriod(option.value)}
                className={`min-h-10 rounded-full border px-4 py-2 text-[10px] uppercase tracking-[0.15em] transition ${period === option.value ? "border-accent/40 bg-accent/[0.1] text-accent" : "border-white/10 text-white/42 hover:text-white"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void syncJobber()}
              disabled={syncing}
              className="min-h-10 rounded-full border border-white/10 px-4 py-2 text-[10px] uppercase tracking-[0.14em] text-white/52 transition hover:border-accent/30 hover:text-accent disabled:opacity-40"
            >
              {syncing ? "Syncing Jobber…" : "Sync Jobber now"}
            </button>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="min-h-10 rounded-full bg-accent px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-black disabled:opacity-40"
            >
              {loading ? "Refreshing…" : "Refresh numbers"}
            </button>
          </div>
        </section>

        {error ? (
          <p className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/[0.06] p-4 text-sm text-red-200">
            {error}
          </p>
        ) : null}
        {syncMessage ? (
          <p className="mt-4 rounded-2xl border border-accent/15 bg-accent/[0.05] p-4 text-sm text-accent/80">
            {syncMessage}
          </p>
        ) : null}

        <section className="mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Completed work"
            value={loading ? "…" : money(metrics?.completedWorkValueCents ?? 0)}
            detail={`${metrics?.jobsCompleted ?? 0} unique jobs marked complete in the service period.`}
          />
          <MetricCard
            label="Booked work"
            value={loading ? "…" : money(metrics?.bookedWorkValueCents ?? 0)}
            detail={`${metrics?.jobsBooked ?? 0} unique jobs scheduled in the selected period.`}
          />
          <MetricCard
            label="Active membership ARR"
            value={loading ? "…" : money(metrics?.activeArrCents ?? 0)}
            detail={`${metrics?.activeMembers ?? 0} strictly active HomeAtlas members.`}
            accent
          />
          <MetricCard
            label="ARR sold"
            value={loading ? "…" : money(metrics?.arrAddedCents ?? 0)}
            detail={`${metrics?.membershipsSold ?? 0} memberships signed during this period.`}
            accent
          />
        </section>

        <section className="mt-12 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-[2rem] border border-white/[0.08] bg-[#0d0c0a]/85 p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-accent/65">
                  Revenue composition
                </p>
                <h2 className="mt-2 font-serif text-3xl text-[#f5f2eb]">
                  Membership work without pretending
                </h2>
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1.5 text-[10px] text-white/42">
                {jobCoverage}% job-link coverage
              </span>
            </div>
            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <MetricCard
                label="Membership-linked paid"
                value={money(metrics?.membershipPaidWorkValueCents ?? 0)}
                detail="Paid Jobber work whose property is actively linked to a membership."
                accent
              />
              <MetricCard
                label="Not membership-linked"
                value={money(metrics?.unclassifiedPaidWorkValueCents ?? 0)}
                detail="Not assumed to be one-time until the Jobber property link proves it."
              />
              <MetricCard
                label="HomeAtlas collected"
                value={money(metrics?.homeAtlasMembershipCollectedCents ?? 0)}
                detail="Confirmed membership/add-on ledger collections; reconciliation only, not added again."
              />
            </div>
            <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent/70 to-[#f5e8c2] transition-[width] duration-700"
                style={{ width: `${jobCoverage}%` }}
              />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-white/35">
              Link coverage is what turns “probably a member” into an auditable membership revenue split.
            </p>
          </article>

          <article className="rounded-[2rem] border border-white/[0.08] bg-[#0d0c0a]/85 p-5 sm:p-7">
            <p className="text-[10px] uppercase tracking-[0.2em] text-accent/65">
              Demand
            </p>
            <h2 className="mt-2 font-serif text-3xl text-[#f5f2eb]">Lead source mix</h2>
            <p className="mt-3 text-sm text-white/42">
              {metrics?.leads ?? 0} leads entered HomeAtlas during this period.
            </p>
            <div className="mt-6 space-y-3">
              {(snapshot?.leadMix ?? []).length > 0 ? (
                snapshot?.leadMix.map((source) => (
                  <div key={source.source} className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-black/20 px-4 py-3">
                    <span className="text-sm text-white/58">{source.source.replaceAll("_", " ")}</span>
                    <span className="font-serif text-xl text-[#f5f2eb]">{source.count}</span>
                  </div>
                ))
              ) : (
                <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-white/35">
                  No leads were recorded in this period.
                </p>
              )}
            </div>
          </article>
        </section>

        <section className="mt-12">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-accent/65">Data health</p>
            <h2 className="mt-2 font-serif text-3xl text-[#f5f2eb]">Trust before totals</h2>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {snapshot
              ? Object.values(snapshot.sources).map((source) => (
                  <SourceCard key={source.label} source={source} />
                ))
              : null}
          </div>
          <p className="mt-3 text-xs text-white/30">
            Dashboard refreshes every 60 seconds. Jobber also feeds HomeAtlas through webhooks and the scheduled reconciliation job.
          </p>
        </section>

        {snapshot?.warnings.length ? (
          <section className="mt-10 rounded-[1.5rem] border border-amber-300/15 bg-amber-300/[0.045] p-5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-amber-200/70">Accuracy notes</p>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-amber-100/55">
              {snapshot.warnings.map((warning) => (
                <li key={warning}>• {warning}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mt-12 grid gap-5 xl:grid-cols-2">
          <article className="rounded-[2rem] border border-white/[0.08] bg-black/20 p-5 sm:p-7">
            <p className="text-[10px] uppercase tracking-[0.2em] text-accent/65">Jobber drill-down</p>
            <h2 className="mt-2 font-serif text-2xl text-[#f5f2eb]">Recent work in period</h2>
            <div className="mt-5 space-y-2">
              {(snapshot?.recentJobs ?? []).slice(0, 10).map((job) => (
                <div key={job.externalJobId} className="grid gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <p className="text-sm text-[#f5f2eb]">{job.customerName}</p>
                    <p className="mt-1 text-xs text-white/35">
                      {job.jobNumber ? `Job #${job.jobNumber} · ` : ""}{job.title} · {dateTime(job.serviceAt)}
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <p className="font-serif text-xl text-[#f5f2eb]">{money(job.amountCents)}</p>
                    <p className="text-[9px] uppercase tracking-[0.12em] text-white/32">
                      {job.invoiceStatus} · {job.membershipAssociated ? "member-linked" : "unclassified"}
                    </p>
                  </div>
                </div>
              ))}
              {!snapshot?.recentJobs.length ? (
                <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-white/35">No Jobber work in this period.</p>
              ) : null}
            </div>
          </article>

          <article className="rounded-[2rem] border border-white/[0.08] bg-black/20 p-5 sm:p-7">
            <p className="text-[10px] uppercase tracking-[0.2em] text-accent/65">Membership drill-down</p>
            <h2 className="mt-2 font-serif text-2xl text-[#f5f2eb]">Contracts signed in period</h2>
            <div className="mt-5 space-y-2">
              {(snapshot?.recentMembershipSales ?? []).slice(0, 10).map((sale) => (
                <div key={sale.membershipId} className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                  <div>
                    <p className="text-sm text-[#f5f2eb]">{sale.customerName}</p>
                    <p className="mt-1 text-xs text-white/35">Signed {dateTime(sale.signedAt)}</p>
                  </div>
                  <p className="font-serif text-xl text-accent">{money(sale.annualizedValueCents)} ARR</p>
                </div>
              ))}
              {!snapshot?.recentMembershipSales.length ? (
                <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-white/35">No membership contracts were signed in this period.</p>
              ) : null}
            </div>
          </article>
        </section>

        <details className="mb-20 mt-12 rounded-[1.5rem] border border-white/[0.08] bg-white/[0.02] p-5">
          <summary className="cursor-pointer text-sm font-medium text-[#f5f2eb]">How every number is defined</summary>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {snapshot?.definitions.map((definition) => (
              <article key={definition.label} className="rounded-xl border border-white/[0.07] bg-black/20 p-4">
                <p className="text-sm text-accent">{definition.label}</p>
                <p className="mt-2 text-xs leading-relaxed text-white/42">{definition.definition}</p>
              </article>
            ))}
          </div>
          <p className="mt-5 text-xs leading-relaxed text-white/32">
            GoHighLevel can later add campaign and call attribution. It should not become the financial ledger or create a second customer identity.
          </p>
        </details>
      </div>
    </AmbientStage>
  );
}

export function BusinessPulsePage() {
  const [unlocked, setUnlocked] = useAdminUnlockedState();
  if (!unlocked) return <AdminPinGate onUnlock={() => setUnlocked(true)} />;
  return <PulseContent />;
}
