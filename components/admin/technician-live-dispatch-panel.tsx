"use client";

import { useMemo, useState } from "react";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import { craftInput, craftPrimaryButton, craftSecondaryButton } from "@/lib/craft/tokens";
import type { TechnicianOperationalProfile } from "@/lib/field-operations/technician-profile";

function localDateTimeValue(date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatDateTime(value: string | null): string {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatHours(minutes: number): string {
  if (minutes <= 0) return "0h";
  const hours = minutes / 60;
  return `${hours.toFixed(hours >= 10 ? 1 : 2)}h`;
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function statusLabel(job: TechnicianOperationalProfile["liveJobs"][number]): string {
  if (job.syncState === "verified") return "Jobber verified";
  if (job.clockState === "finished") return "Done · sync pending";
  if (job.clockState === "running") return "Working · sync pending";
  return "Assigned · sync pending";
}

export function TechnicianLiveDispatchPanel({
  technicianId,
  profile,
  onSaved,
}: {
  technicianId: string;
  profile: TechnicianOperationalProfile;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [serviceTitle, setServiceTitle] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [soldAmount, setSoldAmount] = useState("");
  const [scheduledStart, setScheduledStart] = useState(() => localDateTimeValue());
  const [notes, setNotes] = useState("");

  const recentLiveJobs = useMemo(
    () => profile.liveJobs.slice(0, 8),
    [profile.liveJobs],
  );

  async function createJob() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const parsedAmount = soldAmount.trim() ? Number(soldAmount) : null;
      if (parsedAmount !== null && (!Number.isFinite(parsedAmount) || parsedAmount < 0)) {
        throw new Error("Enter a valid sold amount.");
      }
      const scheduled = new Date(scheduledStart);
      if (!Number.isFinite(scheduled.getTime())) {
        throw new Error("Choose a valid service time.");
      }
      const headers = new Headers(getAdminRequestHeaders());
      headers.set("Content-Type", "application/json");
      const response = await fetch(
        `/api/admin/technicians/${encodeURIComponent(technicianId)}/live-jobs`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            clientRequestId: crypto.randomUUID(),
            scheduledStart: scheduled.toISOString(),
            clientName,
            serviceTitle,
            propertyAddress,
            soldAmountCents:
              parsedAmount === null ? null : Math.round(parsedAmount * 100),
            notes,
          }),
        },
      );
      const body = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Could not add the live job.");
      }
      setClientName("");
      setServiceTitle("");
      setPropertyAddress("");
      setSoldAmount("");
      setNotes("");
      setScheduledStart(localDateTimeValue());
      setOpen(false);
      onSaved();
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Could not add the live job.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-6 rounded-[2rem] border border-accent/20 bg-accent/[0.035] p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-accent">
            Live field truth
          </p>
          <h2 className="mt-2 text-2xl font-semibold">Today stays live even if Jobber is behind.</h2>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted">
            Add a same-day job here as soon as you sell and dispatch it. Tyler can clock in,
            close it out, and complete it from Field Run immediately. HomeAtlas links the same
            job to Jobber later when one safe, unique match appears.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={open ? craftSecondaryButton : craftPrimaryButton}
        >
          {open ? "Close" : "+ Add live job"}
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 text-[11px]">
        <span className="rounded-full border border-success/25 bg-success/[0.07] px-3 py-1.5 text-success">
          HomeAtlas live · {formatDateTime(profile.freshness.homeAtlasLiveAt)}
        </span>
        <span className={`rounded-full border px-3 py-1.5 ${profile.freshness.jobberDataFresh ? "border-foreground/10 bg-foreground/[0.035] text-muted" : "border-warning/25 bg-warning/[0.07] text-warning"}`}>
          Jobber last sync · {formatDateTime(profile.freshness.jobberLastSyncedAt)}
        </span>
        {profile.activity.pendingSyncJobs > 0 ? (
          <span className="rounded-full border border-warning/25 bg-warning/[0.07] px-3 py-1.5 text-warning">
            {profile.activity.pendingSyncJobs} pending sync
          </span>
        ) : null}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Jobs today", profile.activity.todayAssignments.toString()],
          ["Completed today", profile.activity.todayCloseouts.toString()],
          ["Tracked time today", formatHours(profile.activity.todayClockedMinutes)],
          ["Live jobs value", formatMoney(profile.activity.liveSoldAmountCentsToday)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-foreground/10 bg-background/35 p-4">
            <p className="text-[9px] uppercase tracking-[0.17em] text-muted">{label}</p>
            <p className="mt-2 font-serif text-2xl font-light text-foreground">{value}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-muted">
        “Live jobs value” only includes same-day jobs entered through this HomeAtlas live-dispatch lane.
      </p>

      {open ? (
        <div className="mt-6 rounded-[1.4rem] border border-foreground/10 bg-background/45 p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs text-muted">
              Customer / household
              <input
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                placeholder="Barbara LaRue"
                className={`mt-2 w-full ${craftInput}`}
                maxLength={120}
              />
            </label>
            <label className="text-xs text-muted">
              Service
              <input
                value={serviceTitle}
                onChange={(event) => setServiceTitle(event.target.value)}
                placeholder="Exterior window cleaning"
                className={`mt-2 w-full ${craftInput}`}
                maxLength={160}
              />
            </label>
            <label className="text-xs text-muted sm:col-span-2">
              Address
              <input
                value={propertyAddress}
                onChange={(event) => setPropertyAddress(event.target.value)}
                placeholder="123 Main St, Chico"
                className={`mt-2 w-full ${craftInput}`}
                maxLength={320}
              />
            </label>
            <label className="text-xs text-muted">
              Sold amount
              <div className="relative mt-2">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
                <input
                  inputMode="decimal"
                  value={soldAmount}
                  onChange={(event) => setSoldAmount(event.target.value)}
                  placeholder="350"
                  className={`w-full pl-8 ${craftInput}`}
                />
              </div>
            </label>
            <label className="text-xs text-muted">
              Service time
              <input
                type="datetime-local"
                value={scheduledStart}
                onChange={(event) => setScheduledStart(event.target.value)}
                className={`mt-2 w-full ${craftInput}`}
              />
            </label>
            <label className="text-xs text-muted sm:col-span-2">
              Dispatch note <span className="opacity-60">(optional)</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Sold D2D; customer is expecting Tyler today."
                className={`mt-2 min-h-24 w-full resize-y ${craftInput}`}
                maxLength={1000}
              />
            </label>
          </div>
          {error ? (
            <p role="alert" className="mt-4 rounded-xl border border-danger/25 bg-danger/[0.07] p-3 text-xs text-danger">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void createJob()}
            disabled={saving || !clientName.trim() || !serviceTitle.trim()}
            className={`mt-4 w-full sm:w-auto ${craftPrimaryButton}`}
          >
            {saving ? "Dispatching…" : "Dispatch to Tyler now"}
          </button>
        </div>
      ) : null}

      <div className="mt-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Recent live jobs</p>
            <p className="mt-1 text-sm text-foreground/75">One job record from dispatch through Jobber verification.</p>
          </div>
        </div>
        {recentLiveJobs.length > 0 ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {recentLiveJobs.map((job) => (
              <article key={job.assignmentId} className="rounded-[1.15rem] border border-foreground/10 bg-background/35 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{job.clientName}</p>
                    <p className="mt-1 text-xs text-muted">{job.serviceTitle}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[9px] ${job.syncState === "verified" ? "border-success/25 bg-success/[0.07] text-success" : "border-warning/25 bg-warning/[0.07] text-warning"}`}>
                    {statusLabel(job)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
                  <span>{formatDateTime(job.scheduledStart)}</span>
                  {job.soldAmountCents != null ? <span>{formatMoney(job.soldAmountCents)}</span> : null}
                  <span>{job.closeoutSaved ? "Closeout saved" : "Closeout open"}</span>
                </div>
                {job.propertyAddress ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-muted">{job.propertyAddress}</p>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-xl border border-foreground/10 bg-background/30 p-4 text-xs text-muted">
            No live-dispatch jobs yet. Normal synced jobs still appear in Tyler&apos;s totals.
          </p>
        )}
      </div>
    </section>
  );
}
