"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminPinGate } from "./admin-pin-gate";
import { HqFounderNav } from "./hq-founder-nav";
import { FieldCloseoutReview } from "./field-closeout-review";
import { AmbientStage } from "@/components/craft/ambient-stage";
import { StatusNotice } from "@/components/craft/status-notice";
import { craftInput, craftSecondaryButton } from "@/lib/craft/tokens";
import { useAdminUnlockedState } from "@/lib/admin/use-admin-unlocked-state";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import { normalizeOwnerDispatchMonth } from "@/lib/field-operations/owner-dispatch";
import { jobberInvoiceDisplay } from "@/lib/care-operations/jobber-invoice-status";
import { historyNextAction, type TechnicianHistoryPage } from "@/lib/field-records/technician-history";

const timestamp = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
function when(value: string | null) { return value && Number.isFinite(Date.parse(value)) ? timestamp.format(new Date(value)) : "Not recorded"; }

function HistoryWorkspace() {
  const [month, setMonth] = useState(() => normalizeOwnerDispatchMonth(null));
  const [cursor, setCursor] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<TechnicianHistoryPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError(null);
      try {
        const params = new URLSearchParams({ month });
        if (cursor) params.set("cursor", cursor);
        const response = await fetch(`/api/admin/field-records/history?${params}`, { headers: getAdminRequestHeaders(), cache: "no-store", signal: controller.signal });
        const body = await response.json();
        if (!response.ok || !Array.isArray(body.items) || body.month !== month) throw new Error(body.error || "Could not load job history.");
        if (!controller.signal.aborted) setData(previous => {
          const items = cursor && previous?.month === month ? [...previous.items, ...body.items] : body.items;
          return { ...body, items: [...new Map(items.map((item: TechnicianHistoryPage["items"][number]) => [item.assignmentId, item])).values()] };
        });
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load job history."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [month, cursor, refresh]);

  return <AmbientStage className="min-h-screen px-4 py-8 text-foreground sm:px-6">
    <div className="relative mx-auto max-w-5xl">
      <HqFounderNav />
      <header className="mb-6 mt-10">
        <Link href="/hq/today" className="text-sm text-accent underline underline-offset-4">Back to Today</Link>
        <h1 className="mt-4 font-serif text-3xl sm:text-4xl">Technician job history</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">Clocked HomeAtlas jobs, including unfinished work. Choose the month the technician clocked in, in Pacific time. Jobber remains the scheduling and completion source.</p>
      </header>
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <label className="min-w-0 text-sm text-muted">Clock-in month
          <input type="month" min="2000-01" max="2099-12" value={month} className={`mt-2 block ${craftInput}`} onChange={event => { if (/^20\d{2}-(0[1-9]|1[0-2])$/.test(event.target.value)) { setData(null); setCursor(null); setMonth(event.target.value); } }} />
        </label>
        <button type="button" disabled={loading} className={craftSecondaryButton} onClick={() => { setCursor(null); setRefresh(value => value + 1); }}>Refresh history</button>
        <Link href="/hq/billing" className={craftSecondaryButton}>Open Billing</Link>
      </div>
      {error ? <StatusNotice tone="warning">{error}<button type="button" className="ml-3 min-h-11 underline" onClick={() => setRefresh(value => value + 1)} disabled={loading}>Retry history</button></StatusNotice> : null}
      {loading ? <p role="status" className="mb-4 text-sm text-muted">Loading job history…</p> : null}
      {data ? <>
        <p className="mb-4 text-sm text-muted">{data.items.length} jobs shown{data.nextCursor ? " · more available below" : ""}{error ? " · last loaded records" : ""}</p>
        {!data.items.length && !error && !loading ? <p className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted">No HomeAtlas technician clock-ins recorded for this month. Scheduled but unstarted jobs remain in Dispatch.</p> : null}
        <div className="space-y-5">{data.items.map(item => {
          const invoice = jobberInvoiceDisplay(item.invoiceStatus);
          const minutes = item.clock.durationSeconds === null ? null : Math.floor(item.clock.durationSeconds / 60);
          return <article key={item.assignmentId} className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
            <div className="flex flex-wrap justify-between gap-2">
              <h2 className="text-lg font-medium">{item.clientName}</h2>
              <span className="text-sm text-accent">{historyNextAction(item)}</span>
            </div>
            <p className="mt-1 text-sm text-muted">{item.technicianName} · {item.service}</p>
            <dl className="my-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div><dt className="text-muted">Clocked in</dt><dd className="mt-1">{when(item.clock.startedAt)}</dd></div>
              <div><dt className="text-muted">Clocked out</dt><dd className="mt-1">{item.clock.state === "running" ? "Still running — review with technician" : when(item.clock.endedAt)}</dd></div>
              <div><dt className="text-muted">Recorded job time</dt><dd className="mt-1 tabular-nums">{minutes === null ? "Not final" : `${Math.floor(minutes / 60)}h ${minutes % 60}m`}</dd></div>
            </dl>
            <p className="mb-3 text-sm text-muted">Jobber: {item.jobberComplete === null ? "unavailable" : item.jobberComplete ? "complete" : "not marked complete"}{item.jobberStatus === "REMOVED" ? " · removed from schedule" : ""}. Clocking out does not complete Jobber or charge a card.</p>
            <div className="mb-4 rounded-xl border border-border p-3 text-sm">
              <p>{invoice.label}</p><p className="mt-1 text-muted">{invoice.detail}</p>
              <p className="mt-1 text-xs text-muted">Source sync: {when(item.sourceObservedAt)} Pacific</p>
            </div>
            {item.hasCloseout ? <>
              <p className="mb-2 text-xs text-muted">{item.photoCount} {item.photoCount === 1 ? "photo" : "photos"} · {item.openFollowUp ? "Owner issue open" : "No unresolved issue recorded"}</p>
              <FieldCloseoutReview assignmentId={item.assignmentId} onResolved={() => setData(current => current ? { ...current, items: current.items.map(row => row.assignmentId === item.assignmentId ? { ...row, openFollowUp: false } : row) } : current)} />
            </> : <p className="text-sm text-warning">No closeout submitted. Check with the technician before marking this work complete.</p>}
          </article>;
        })}</div>
        {data.nextCursor ? <button type="button" disabled={loading || Boolean(error)} className={`mt-5 ${craftSecondaryButton}`} onClick={() => setCursor(data.nextCursor)}>Load older jobs</button> : null}
      </> : null}
    </div>
  </AmbientStage>;
}

export function TechnicianHistory() {
  const [unlocked, setUnlocked] = useAdminUnlockedState();
  return unlocked ? <HistoryWorkspace /> : <AdminPinGate onUnlock={() => setUnlocked(true)} />;
}
