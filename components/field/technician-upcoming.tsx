"use client";
import { useState } from "react";
import { StatusNotice } from "@/components/craft/status-notice";
import type { FieldUpcomingVisit } from "@/lib/field-operations/field-upcoming";

export function TechnicianUpcoming() {
  const [open, setOpen] = useState(false);
  const [visits, setVisits] = useState<FieldUpcomingVisit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function load() {
    setOpen(true); setLoading(true); setError(null);
    try {
      const response = await fetch("/api/field/upcoming", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load upcoming jobs.");
      setVisits(body.visits);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load upcoming jobs."); }
    finally { setLoading(false); }
  }
  const date = (value: string) => new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
  return <section className="mb-6 rounded-[var(--radius-card-lg)] border border-accent/25 bg-surface-elevated p-5">
    <button type="button" aria-expanded={open} disabled={loading} onClick={() => open ? setOpen(false) : void load()} className="flex min-h-12 w-full items-center justify-between gap-4 text-left disabled:opacity-50">
      <span><span className="block text-lg font-semibold text-foreground">Upcoming jobs</span><span className="mt-1 block text-sm text-muted">Look ahead at your next six weeks.</span></span>
      <span className="text-accent" aria-hidden>{loading ? "…" : open ? "−" : "+"}</span>
    </button>
    {open ? <div className="mt-4 space-y-3">
      <p className="text-sm leading-relaxed text-muted">Plan ahead here. On service day, use Today below to clock in, save your work, and clock out. Dates stay controlled by Jobber.</p>
      {loading ? <p role="status" className="text-sm text-muted">Loading your schedule…</p> : error ? <StatusNotice tone="danger">{error}</StatusNotice> : visits.length ? <ul className="space-y-3">
        {visits.map(visit => <li key={visit.id} className="rounded-2xl border border-border bg-background/40 p-4">
          <p className="text-sm font-medium text-accent">{date(visit.scheduledStart)}</p>
          <h3 className="mt-2 text-base font-semibold text-foreground">{visit.clientName}</h3>
          <p className="mt-1 break-words text-sm leading-relaxed text-muted">{visit.service}</p>
          {visit.address ? <p className="mt-2 text-sm text-muted">{visit.address}</p> : null}
        </li>)}
      </ul> : <p className="rounded-xl border border-border p-4 text-sm text-muted">No future jobs assigned in the next 45 days. New assignments from HQ will appear here.</p>}
      <button type="button" onClick={() => void load()} disabled={loading} className="min-h-11 text-sm text-accent underline underline-offset-4 disabled:opacity-50">Refresh upcoming jobs</button>
    </div> : null}
  </section>;
}
