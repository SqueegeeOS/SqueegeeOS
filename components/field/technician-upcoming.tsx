"use client";

import { useCallback, useEffect, useState } from "react";
import { JobValue } from "./job-value";
import { StatusNotice } from "@/components/craft/status-notice";
import type { FieldUpcomingVisit } from "@/lib/field-operations/field-upcoming";
import { jobDirectionsHref } from "@/lib/care-operations/jobber-visit-address";

function dateParts(value: string) {
  const date = new Date(value);
  return {
    weekday: new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      weekday: "short",
    }).format(date),
    month: new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      month: "short",
    }).format(date),
    day: new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      day: "numeric",
    }).format(date),
    time: new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "numeric",
      minute: "2-digit",
    }).format(date),
  };
}

function endTime(value: string | null): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

async function fetchUpcomingVisits(): Promise<FieldUpcomingVisit[]> {
  const response = await fetch("/api/field/upcoming", { cache: "no-store" });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Could not load upcoming jobs.");
  return body.visits;
}

export function TechnicianUpcoming({
  featured = false,
  defaultOpen = false,
}: {
  featured?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [visits, setVisits] = useState<FieldUpcomingVisit[]>([]);
  const [loading, setLoading] = useState(defaultOpen);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setOpen(true); setLoading(true); setError(null);
    try {
      setVisits(await fetchUpcomingVisits());
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load upcoming jobs."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!defaultOpen) return;
    let active = true;
    void fetchUpcomingVisits()
      .then((nextVisits) => {
        if (active) setVisits(nextVisits);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load upcoming jobs.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [defaultOpen]);

  const content = open ? (
    <div className={featured ? "mt-5" : "mt-4 space-y-3"}>
      {loading ? (
        <div role="status" className="grid gap-3">
          <div className="h-28 animate-pulse rounded-[1.35rem] border border-foreground/10 bg-foreground/[0.035]" />
          <p className="text-sm text-muted">Loading Tyler&apos;s assigned schedule…</p>
        </div>
      ) : error ? (
        <StatusNotice tone="danger">{error}</StatusNotice>
      ) : visits.length ? (
        <ul className="space-y-3">
          {visits.map((visit, index) => {
            const date = dateParts(visit.scheduledStart);
            const finish = endTime(visit.scheduledEnd);
            const directions = jobDirectionsHref(visit.address);
            return (
              <li
                key={visit.id}
                className={`relative overflow-hidden rounded-[1.35rem] border p-4 sm:p-5 ${
                  featured && index === 0
                    ? "border-accent/35 bg-accent/[0.075] shadow-[0_18px_50px_rgba(0,0,0,0.16)]"
                    : "border-foreground/10 bg-background/35"
                }`}
              >
                {featured && index === 0 ? (
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.11),transparent_54%)]" aria-hidden />
                ) : null}
                <div className="relative flex items-start gap-4">
                  <div className="w-14 shrink-0 rounded-2xl border border-accent/25 bg-background/50 px-2 py-2.5 text-center">
                    <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-accent">{date.weekday}</p>
                    <p className="mt-1 font-serif text-2xl font-light leading-none text-foreground">{date.day}</p>
                    <p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-muted">{date.month}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        {featured && index === 0 ? (
                          <p className="mb-1 text-[9px] uppercase tracking-[0.18em] text-accent">Next assigned stop</p>
                        ) : null}
                        <h3 className="text-base font-semibold text-foreground">{visit.clientName}</h3>
                      </div>
                      <p className="shrink-0 text-sm font-medium text-accent">
                        {date.time}{finish ? `–${finish}` : ""}
                      </p>
                    </div>
                    <p className="mt-1 break-words text-sm leading-relaxed text-muted">{visit.service}</p>
                    {visit.address ? <p className="mt-3 text-sm leading-relaxed text-foreground/70">{visit.address}</p> : null}
                    <JobValue value={visit.jobValue} />
                    {directions ? (
                      <a
                        href={directions}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex min-h-11 items-center rounded-full border border-accent/25 bg-accent/[0.07] px-4 text-xs font-medium uppercase tracking-[0.12em] text-accent"
                        aria-label={`Directions to ${visit.clientName}`}
                      >
                        Open directions ↗
                      </a>
                    ) : (
                      <p className="mt-3 text-sm text-warning">Street address unavailable. Ask HQ before traveling.</p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-[1.25rem] border border-foreground/10 bg-background/35 p-5">
          <p className="text-sm font-medium text-foreground">The road ahead is clear.</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">No future jobs are assigned in the next 45 days. New dispatches from HQ will appear here automatically.</p>
        </div>
      )}

      {!loading ? (
        <button type="button" onClick={() => void load()} className="mt-3 min-h-11 text-xs uppercase tracking-[0.14em] text-accent underline underline-offset-4">
          Refresh dispatch
        </button>
      ) : null}
    </div>
  ) : null;

  if (featured) {
    return (
      <section id="upcoming-jobs" className="mt-7 scroll-mt-6 overflow-hidden rounded-[2rem] border border-accent/30 bg-surface-elevated p-5 shadow-[var(--shadow-float)] sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-foreground/10 pb-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-accent">Live from dispatch</p>
            <h2 className="mt-2 font-serif text-3xl font-light tracking-[-0.035em] text-foreground">Your upcoming route.</h2>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">Every future stop assigned to Tyler for the next 45 days, with the time, address, service, and job value needed to plan ahead.</p>
          </div>
          {!loading && !error ? (
            <span className="rounded-full border border-success/25 bg-success/[0.07] px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-success">
              {visits.length} assigned
            </span>
          ) : null}
        </div>
        {content}
      </section>
    );
  }

  return (
    <section id="upcoming-jobs" className="mb-6 scroll-mt-6 rounded-[var(--radius-card-lg)] border border-accent/25 bg-surface-elevated p-5">
      <button type="button" aria-expanded={open} disabled={loading} onClick={() => open ? setOpen(false) : void load()} className="flex min-h-12 w-full items-center justify-between gap-4 text-left disabled:opacity-50">
        <span><span className="block text-lg font-semibold text-foreground">Upcoming jobs</span><span className="mt-1 block text-sm text-muted">Look ahead at your next six weeks.</span></span>
        <span className="text-accent" aria-hidden>{loading ? "…" : open ? "−" : "+"}</span>
      </button>
      {content}
    </section>
  );
}
