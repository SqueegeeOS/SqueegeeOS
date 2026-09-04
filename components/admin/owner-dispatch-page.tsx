"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { HqFounderNav } from "@/components/admin/hq-founder-nav";
import { OwnerDispatchMap } from "@/components/admin/owner-dispatch-map";
import { AmbientStage } from "@/components/craft/ambient-stage";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import { useAdminUnlockedState } from "@/lib/admin/use-admin-unlocked-state";
import type {
  OwnerDispatchPayload,
  OwnerDispatchVisit,
} from "@/lib/field-operations/owner-dispatch";
import {
  craftEyebrow,
  craftInput,
  craftPrimaryButton,
  craftSecondaryButton,
} from "@/lib/craft/tokens";

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const TIME_FORMAT = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Los_Angeles",
});

function currentMonth(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
}

function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return shifted.toISOString().slice(0, 7);
}

function dateKey(value: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function monthTitle(month: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return "Time not set";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return [hours ? `${hours}h` : "", remainder ? `${remainder}m` : ""]
    .filter(Boolean)
    .join(" ");
}

function visitDuration(visit: OwnerDispatchVisit): number {
  if (!visit.scheduledEnd) return 0;
  return Math.max(
    0,
    Math.round(
      (Date.parse(visit.scheduledEnd) - Date.parse(visit.scheduledStart)) /
        60_000,
    ),
  );
}

function visitCrew(visit: OwnerDispatchVisit) {
  return visit.homeAtlasAssignedTechnician
    ? [visit.homeAtlasAssignedTechnician]
    : visit.assignedUsers;
}

function visitIsUnassigned(visit: OwnerDispatchVisit): boolean {
  return !visit.homeAtlasAssignedTechnician &&
    visit.assignmentReadState === "available" &&
    visit.assignedUsers.length === 0;
}

function Metric({ label, value, detail, warning = false }: {
  label: string;
  value: string | number;
  detail: string;
  warning?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${warning ? "border-amber-300/25 bg-amber-300/[0.07]" : "border-white/10 bg-white/[0.035]"}`}>
      <p className="text-[9px] uppercase tracking-[0.17em] text-white/40">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${warning ? "text-amber-100" : "text-white"}`}>{value}</p>
      <p className="mt-1 text-[11px] text-white/38">{detail}</p>
    </div>
  );
}

function CalendarStrip({ month, visits, selectedDay, onSelectDay }: {
  month: string;
  visits: OwnerDispatchVisit[];
  selectedDay: string | null;
  onSelectDay: (day: string | null) => void;
}) {
  const [year, monthNumber] = month.split("-").map(Number);
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const leading = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const grouped = new Map<string, OwnerDispatchVisit[]>();
  for (const visit of visits) {
    const day = dateKey(visit.scheduledStart);
    grouped.set(day, [...(grouped.get(day) ?? []), visit]);
  }
  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/15 p-3 sm:p-4">
      <div className="grid grid-cols-7 gap-1 text-center text-[9px] uppercase tracking-[0.14em] text-white/35">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day) => <div key={day} className="py-2">{day}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: leading }, (_, index) => <div key={`blank-${index}`} />)}
        {Array.from({ length: days }, (_, index) => {
          const dayNumber = index + 1;
          const day = `${month}-${String(dayNumber).padStart(2, '0')}`;
          const dayVisits = grouped.get(day) ?? [];
          const active = selectedDay === day;
          const unassigned = dayVisits.filter(visitIsUnassigned).length;
          return (
            <button
              type="button"
              key={day}
              onClick={() => onSelectDay(active ? null : day)}
              aria-pressed={active}
              className={`min-h-[4.25rem] rounded-xl border p-2 text-left transition ${active ? 'border-accent/60 bg-accent/[0.12]' : 'border-white/[0.06] bg-white/[0.025] hover:border-white/15'}`}
            >
              <span className="text-[11px] text-white/55">{dayNumber}</span>
              {dayVisits.length ? <span className="mt-2 block text-sm font-semibold text-white">{dayVisits.length}</span> : null}
              {unassigned ? <span className="mt-1 block h-1.5 w-1.5 rounded-full bg-amber-300" aria-label={`${unassigned} unassigned`} /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function OwnerDispatchPage() {
  const [unlocked, setUnlocked] = useAdminUnlockedState();
  const [month, setMonth] = useState(currentMonth);
  const [payload, setPayload] = useState<OwnerDispatchPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [assignmentSuccess, setAssignmentSuccess] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  const [technician, setTechnician] = useState("all");
  const [city, setCity] = useState("all");
  const [query, setQuery] = useState("");
  const [assignmentTechnicianId, setAssignmentTechnicianId] = useState("");
  const didAutoAdvanceEmptyCurrentMonth = useRef(false);

  const load = useCallback(async () => {
    if (!unlocked) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/dispatch?month=${encodeURIComponent(month)}`, {
        headers: getAdminRequestHeaders(),
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as (OwnerDispatchPayload & { error?: string }) | null;
      if (!response.ok || !body?.visits) throw new Error(body?.error ?? "Could not load dispatch.");
      if (
        !didAutoAdvanceEmptyCurrentMonth.current &&
        month === currentMonth() &&
        body.visits.length === 0
      ) {
        didAutoAdvanceEmptyCurrentMonth.current = true;
        setMonth(shiftMonth(month, 1));
        return;
      }
      setPayload(body);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load dispatch.");
    } finally {
      setLoading(false);
    }
  }, [month, unlocked]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const syncJobber = async () => {
    setSyncing(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/care-operations/jobber/sync", {
        method: "POST",
        headers: getAdminRequestHeaders(),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? "Jobber sync stopped safely.");
      await load();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Jobber sync stopped safely.");
    } finally {
      setSyncing(false);
    }
  };

  const cities = useMemo(() => [...new Set((payload?.visits ?? []).flatMap((visit) => visit.city ? [visit.city] : []))].sort(), [payload?.visits]);
  const filteredVisits = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (payload?.visits ?? []).filter((visit) => {
      if (selectedDay && dateKey(visit.scheduledStart) !== selectedDay) return false;
      if (technician === "unassigned") {
        if (!visitIsUnassigned(visit)) return false;
      } else if (technician !== "all" && !visitCrew(visit).some((user) => user.id === technician)) return false;
      if (city !== "all" && visit.city !== city) return false;
      if (!needle) return true;
      return [visit.clientName, visit.serviceLabel, visit.address ?? "", ...visit.scopeItems.map((item) => item.name)].join(" ").toLowerCase().includes(needle);
    });
  }, [city, payload?.visits, query, selectedDay, technician]);

  const selectedVisit = useMemo(() => filteredVisits.find((visit) => visit.projectionId === selectedVisitId) ?? filteredVisits[0] ?? null, [filteredVisits, selectedVisitId]);
  const unassignedVisits = (payload?.visits ?? []).filter((visit) => visitIsUnassigned(visit) && !visit.isComplete);

  const selectVisit = (projectionId: string) => {
    setSelectedVisitId(projectionId);
    setAssignmentTechnicianId("");
    setAssignmentError(null);
    setAssignmentSuccess(null);
  };

  const assignTechnician = async () => {
    if (!selectedVisit || !assignmentTechnicianId) return;
    setAssigning(true);
    setAssignmentError(null);
    setAssignmentSuccess(null);
    try {
      const response = await fetch("/api/admin/dispatch/assignment", {
        method: "POST",
        headers: {
          ...getAdminRequestHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectionId: selectedVisit.projectionId,
          jobberUserId: assignmentTechnicianId,
          expectedAssignedUserIds: selectedVisit.assignedUsers.map(
            (user) => user.id,
          ),
          expectedHomeAtlasTechnicianId:
            selectedVisit.homeAtlasAssignedTechnician?.id ?? null,
          clientRequestId: crypto.randomUUID(),
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        assignedUsers?: Array<{ id: string; name: string }>;
      } | null;
      if (!response.ok || !body?.assignedUsers?.length) {
        throw new Error(body?.error ?? "Jobber did not confirm that assignment.");
      }
      const assignedName = body.assignedUsers[0]?.name ?? "Technician";
      await load();
      setAssignmentSuccess(
        assignmentTechnicianId.startsWith("homeatlas:")
          ? `${assignedName} is assigned in HomeAtlas. Jobber still owns the visit schedule.`
          : `${assignedName} is confirmed on this visit in Jobber.`,
      );
    } catch (assignmentFailure) {
      setAssignmentError(
        assignmentFailure instanceof Error
          ? assignmentFailure.message
          : "The assignment stopped safely.",
      );
    } finally {
      setAssigning(false);
    }
  };

  if (!unlocked) return <AdminPinGate onUnlock={() => setUnlocked(true)} />;

  return (
    <AmbientStage className="min-h-screen text-foreground">
      <main className="mx-auto max-w-[92rem] px-4 py-5 pb-24 sm:px-6 sm:py-7">
        <HqFounderNav />
        <header className="mt-10 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className={craftEyebrow}>HQ · Dispatch command</p>
            <h1 className="mt-3 font-serif text-4xl font-light tracking-[-0.04em] sm:text-6xl">Upcoming work. Place the crew.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted sm:text-base">Every future Jobber visit, route density, workload, and technician assignment—controlled from one owner-only command board.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={month <= currentMonth()} onClick={() => setMonth(shiftMonth(month, -1))} className={craftSecondaryButton}>Previous</button>
            <button type="button" onClick={() => setMonth(currentMonth())} className={craftSecondaryButton}>This month</button>
            <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} className={craftSecondaryButton}>Next</button>
            <button type="button" disabled={syncing} onClick={() => void syncJobber()} className={craftPrimaryButton}>{syncing ? "Syncing…" : "Sync Jobber"}</button>
          </div>
        </header>

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-black/20 p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.19em] text-accent">{monthTitle(month)}</p>
              <p className="mt-2 text-xs text-white/40">{payload?.accountName ?? "Jobber account"} · Pacific time</p>
            </div>
            <p className={`rounded-full border px-3 py-2 text-[10px] uppercase tracking-[0.14em] ${payload?.connected ? "border-emerald-300/25 text-emerald-100" : "border-amber-300/25 text-amber-100"}`}>{payload?.connected ? "Jobber connected" : "Reconnect Jobber"}</p>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <Metric label="Upcoming" value={payload?.summary.total ?? 0} detail="Future visits only" />
            <Metric label="Crew ready" value={payload?.summary.assigned ?? 0} detail="Jobber or HomeAtlas staffed" />
            <Metric label="Unassigned" value={payload?.summary.assignmentUnknown ? "—" : (payload?.summary.unassigned ?? 0)} detail={payload?.summary.assignmentUnknown ? "Visibility incomplete" : "Needs Jobber crew"} warning={Boolean(payload?.summary.unassigned || payload?.summary.assignmentUnknown)} />
            <Metric label="Technicians" value={payload?.assignableUsers.length ?? 0} detail="Available field crew" />
            <Metric label="Mapped" value={payload?.summary.mapped ?? 0} detail="Route-ready pins" />
            <Metric label="Crew hours" value={formatDuration(payload?.summary.scheduledMinutes ?? 0)} detail="Scheduled duration" />
          </div>
        </section>

        {!payload?.connected ? <div className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-300/[0.07] p-4 text-sm text-amber-100">The saved month is visible, but assignments can only be trusted after Jobber reconnects and syncs. <Link href="/hq/jobber" className="underline underline-offset-4">Reconnect Jobber</Link>.</div> : null}
        {error ? <div role="alert" className="mt-5 rounded-2xl border border-red-300/25 bg-red-300/[0.07] p-4 text-sm text-red-100">{error}</div> : null}

        <section className="mt-6 grid gap-3 md:grid-cols-4">
          <input value={query} onChange={(event) => setQuery(event.target.value)} className={craftInput} placeholder="Search customer, service, address" />
          <select value={technician} onChange={(event) => setTechnician(event.target.value)} className={craftInput} aria-label="Filter technician">
            <option value="all">All technicians</option><option value="unassigned">Unassigned only</option>
            {(payload?.crew ?? []).map((member) => <option key={member.jobberUserId} value={member.jobberUserId}>{member.displayName} · {member.visitCount}</option>)}
          </select>
          <select value={city} onChange={(event) => setCity(event.target.value)} className={craftInput} aria-label="Filter city"><option value="all">All cities</option>{cities.map((value) => <option key={value} value={value}>{value}</option>)}</select>
          <button type="button" className={craftSecondaryButton} onClick={() => { setSelectedDay(null); setTechnician("all"); setCity("all"); setQuery(""); }}>Clear filters</button>
        </section>

        <section className="mt-6"><CalendarStrip month={month} visits={payload?.visits ?? []} selectedDay={selectedDay} onSelectDay={setSelectedDay} /></section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(21rem,0.55fr)]">
          <OwnerDispatchMap visits={filteredVisits} selectedVisitId={selectedVisit?.projectionId ?? null} onSelect={selectVisit} />
          <div className="rounded-[1.6rem] border border-white/10 bg-[#111615] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3"><div><p className={craftEyebrow}>Unassigned queue</p><h2 className="mt-2 font-serif text-3xl font-light">Close the gaps.</h2></div><span className="rounded-full border border-amber-300/25 px-3 py-1.5 text-sm tabular-nums text-amber-100">{unassignedVisits.length}</span></div>
            <p className="mt-3 text-xs leading-5 text-white/45">Pick a visit below, then place either Jobber crew or a HomeAtlas technician without buying another Jobber seat.</p>
            <div className="mt-5 max-h-[25rem] space-y-3 overflow-y-auto pr-1">
              {unassignedVisits.length ? unassignedVisits.map((visit) => (
                <button key={visit.projectionId} type="button" onClick={() => selectVisit(visit.projectionId)} className="w-full rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-left hover:border-amber-300/25">
                  <div className="flex items-center justify-between gap-3"><p className="truncate text-sm font-medium text-white">{visit.clientName}</p><span className="shrink-0 text-[10px] text-amber-100">{DATE_FORMAT.format(new Date(visit.scheduledStart))}</span></div>
                  <p className="mt-1 truncate text-xs text-white/40">{visit.serviceLabel}</p>
                </button>
              )) : <p className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.055] p-4 text-sm text-emerald-100">No verified unassigned visits this month.</p>}
            </div>
          </div>
        </section>

        {selectedVisit ? (
          <section className="mt-6 rounded-[2rem] border border-accent/20 bg-gradient-to-br from-accent/[0.075] to-black/25 p-6 sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-start">
              <div>
                <p className={craftEyebrow}>Selected visit · {DATE_FORMAT.format(new Date(selectedVisit.scheduledStart))}</p>
                <h2 className="mt-3 font-serif text-3xl font-light sm:text-4xl">{selectedVisit.clientName}</h2>
                <p className="mt-2 text-sm text-white/55">{selectedVisit.serviceLabel} · {TIME_FORMAT.format(new Date(selectedVisit.scheduledStart))}{selectedVisit.scheduledEnd ? `–${TIME_FORMAT.format(new Date(selectedVisit.scheduledEnd))}` : ""}</p>
                <p className="mt-2 text-sm text-white/45">{selectedVisit.address ?? "Address not available in the current Jobber projection"}</p>
                <div className="mt-4 flex flex-wrap gap-2">{visitCrew(selectedVisit).length ? visitCrew(selectedVisit).map((user) => <span key={user.id} className="rounded-full border border-emerald-300/20 px-3 py-1.5 text-xs text-emerald-100">{user.name}{selectedVisit.homeAtlasAssignedTechnician?.id === user.id ? " · HomeAtlas" : " · Jobber"}</span>) : selectedVisit.assignmentReadState === "available" ? <span className="rounded-full border border-amber-300/25 px-3 py-1.5 text-xs text-amber-100">Unassigned</span> : <span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/55">Saved crew not visible · assignment will verify live</span>}<span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/50">{formatDuration(visitDuration(selectedVisit))}</span></div>
                {selectedVisit.scopeItems.length ? <ul className="mt-5 grid gap-2 sm:grid-cols-2">{selectedVisit.scopeItems.map((item) => <li key={item.id} className="rounded-xl border border-white/[0.07] bg-black/15 px-3 py-2 text-xs text-white/60">{item.name}{item.quantity !== 1 ? ` × ${item.quantity}` : ""}</li>)}</ul> : null}
              </div>
              <div className="flex min-w-[13rem] flex-col gap-2">
                <label htmlFor="dispatch-technician" className="text-[10px] uppercase tracking-[0.16em] text-white/45">Technician</label>
                <select
                  id="dispatch-technician"
                  value={assignmentTechnicianId}
                  onChange={(event) => setAssignmentTechnicianId(event.target.value)}
                  disabled={payload?.assignmentCapability !== "available" || assigning}
                  className={craftInput}
                >
                  <option value="">Choose technician</option>
                  {(payload?.assignableUsers ?? []).map((user) => (
                    <option key={user.id} value={user.id}>{user.name} · {user.source === "homeatlas" ? "HomeAtlas tech" : "Jobber"}</option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={
                    assigning ||
                    !assignmentTechnicianId ||
                    payload?.assignmentCapability !== "available"
                  }
                  onClick={() => void assignTechnician()}
                  className={craftPrimaryButton}
                >
                  {assigning ? "Confirming assignment…" : "Assign technician"}
                </button>
                <p className="text-[11px] leading-5 text-white/38">HomeAtlas tech assignments do not require another Jobber seat. The date, time, and job itself remain controlled by Jobber.</p>
                {payload?.assignmentMessage ? (
                  <p className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-3 text-xs leading-5 text-amber-100">
                    {payload.assignmentMessage}{" "}
                    {payload.assignmentCapability === "permission_required" ? <Link href="/hq/jobber" className="underline underline-offset-4">Reconnect Jobber</Link> : null}
                  </p>
                ) : null}
                {assignmentError ? <p role="alert" className="rounded-xl border border-red-300/20 bg-red-300/[0.06] p-3 text-xs leading-5 text-red-100">{assignmentError}</p> : null}
                {assignmentSuccess ? <p role="status" className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] p-3 text-xs leading-5 text-emerald-100">{assignmentSuccess}</p> : null}
                {selectedVisit.jobberPropertyWebUri ? <a href={selectedVisit.jobberPropertyWebUri} target="_blank" rel="noreferrer" className={craftSecondaryButton}>Open property in Jobber</a> : null}
                <Link href={selectedVisit.homeAtlasVisitHref} className={craftSecondaryButton}>Open HomeAtlas record</Link>
              </div>
            </div>
          </section>
        ) : null}

        {loading && !payload ? <div className="mt-8 rounded-[2rem] border border-white/10 p-12 text-center text-sm text-muted">Building the dispatch month…</div> : null}

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ["Route clusters", "Flag days where the crew zig-zags across town; suggest tighter neighborhood sequencing."],
            ["Capacity forecast", "Compare booked crew-hours with each technician’s proven independent capacity before the month gets overloaded."],
            ["David handoff", "Show David nearby upcoming work and existing proof zones without exposing billing or private HQ controls."],
          ].map(([title, copy]) => <article key={title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><p className="text-sm font-semibold text-white">{title}</p><p className="mt-2 text-xs leading-5 text-white/42">{copy}</p></article>)}
        </section>
      </main>
    </AmbientStage>
  );
}
