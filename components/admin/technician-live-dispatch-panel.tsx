"use client";

import { useMemo, useState } from "react";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import { craftInput, craftPrimaryButton, craftSecondaryButton } from "@/lib/craft/tokens";
import type { TechnicianOperationalProfile } from "@/lib/field-operations/technician-profile";

const SERVICE_PRESETS = [
  "Window cleaning",
  "Gutter cleaning",
  "Solar panel cleaning",
  "Pressure washing",
  "Soft wash",
] as const;

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
  const [showMore, setShowMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [serviceTitle, setServiceTitle] = useState("Window cleaning");
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
      setServiceTitle("Window cleaning");
      setPropertyAddress("");
      setSoldAmount("");
      setNotes("");
      setScheduledStart(localDateTimeValue());
      setShowMore(false);
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
            Door-knocking flow: keep the customer/job in Jobber first, then do the tiny Atlas dispatch so Tyler sees it immediately. Atlas reconciles the same job later instead of making you maintain two full records.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={open ? craftSecondaryButton : craftPrimaryButton}
        >
          {open ? "Close" : "+ Quick dispatch"}
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-accent/15 bg-accent/[0.04] p-3 text-[11px] leading-relaxed text-foreground/70">
        <span className="font-semibold text-accent">Knock mode:</span> Jobber = customer + schedule source of truth. Atlas = fastest field handoff + labor + proof. If Jobber sync is instant, great; if not, Tyler still has the job.
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
          ["Recorded time today", formatHours(profile.activity.todayRecordedMinutes)],
          ["Live jobs value", formatMoney(profile.activity.liveSoldAmountCentsToday)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-foreground/10 bg-background/35 p-4">
            <p className="text-[9px] uppercase tracking-[0.17em] text-muted">{label}</p>
            <p className="mt-2 font-serif text-2xl font-light text-foreground">{value}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-muted">
        Recorded time = verified field clocks + clearly labeled owner-entered corrections. Live jobs value only includes same-day jobs entered through Atlas Quick Dispatch.
      </p>

      {open ? (
        <div className="mt-6 rounded-[1.4rem] border border-foreground/10 bg-background/45 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-accent">Fast second entry</p>
              <p className="mt-1 text-xs text-muted">Time defaults to now. Notes stay hidden unless you need them.</p>
            </div>
            <span className="rounded-full border border-success/20 bg-success/[0.06] px-3 py-1 text-[10px] text-success">mobile-first</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs text-muted">
              Customer
              <input
                autoFocus
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                placeholder="Barbara LaRue"
                className={`mt-2 w-full ${craftInput}`}
                maxLength={120}
                autoComplete="name"
              />
            </label>
            <label className="text-xs text-muted">
              Sold amount <span className="opacity-60">(optional)</span>
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

            <div className="sm:col-span-2">
              <p className="text-xs text-muted">Service</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {SERVICE_PRESETS.map((service) => (
                  <button
                    key={service}
                    type="button"
                    onClick={() => setServiceTitle(service)}
                    className={`min-h-10 rounded-full border px-3 text-[11px] ${serviceTitle === service ? "border-accent/40 bg-accent/10 text-accent" : "border-foreground/10 bg-foreground/[0.025] text-muted"}`}
                  >
                    {service}
                  </button>
                ))}
              </div>
              <input
                value={serviceTitle}
                onChange={(event) => setServiceTitle(event.target.value)}
                placeholder="Or type the Jobber service title"
                className={`mt-2 w-full ${craftInput}`}
                maxLength={160}
              />
            </div>

            <label className="text-xs text-muted sm:col-span-2">
              Address <span className="opacity-60">(optional, but strongest Jobber match)</span>
              <input
                value={propertyAddress}
                onChange={(event) => setPropertyAddress(event.target.value)}
                placeholder="Paste from Jobber if convenient"
                className={`mt-2 w-full ${craftInput}`}
                maxLength={320}
                autoComplete="street-address"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={() => setShowMore((value) => !value)}
            className="mt-4 min-h-10 rounded-full border border-foreground/10 px-3 text-[11px] text-muted"
          >
            {showMore ? "Hide extra details" : "Need to change time or add a note?"}
          </button>

          {showMore ? (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
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
                  placeholder="Customer is expecting Tyler after 3 PM."
                  className={`mt-2 min-h-20 w-full resize-y ${craftInput}`}
                  maxLength={1000}
                />
              </label>
            </div>
          ) : null}

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
            {saving ? "Sending to Tyler…" : "Send to Tyler"}
          </button>
        </div>
      ) : null}

      <div className="mt-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Recent live jobs</p>
            <p className="mt-1 text-sm text-foreground/75">One Atlas job record from dispatch through Jobber verification.</p>
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
