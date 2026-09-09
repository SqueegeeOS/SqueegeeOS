"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import { businessTodayIsoDate } from "@/lib/admin/company-business-timezone";
import { useAdminUnlockedState } from "@/lib/admin/use-admin-unlocked-state";
import type {
  TechnicianOperationalProfile,
  TechnicianTimeRepairCandidate,
} from "@/lib/field-operations/technician-profile";

function formatHours(minutes: number): string {
  const hours = minutes / 60;
  return `${hours.toFixed(hours >= 10 ? 1 : 2)}h`;
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function reasonLabel(value: string): string {
  if (value === "pre_atlas") return "Before Atlas";
  if (value === "owner_correction") return "Owner correction";
  return "Missed clock";
}

function EvidenceCheck({ pass, label }: { pass: boolean; label: string }) {
  return (
    <span
      className={
        pass
          ? "rounded-full border border-success/25 bg-success/[0.07] px-2.5 py-1 text-[10px] text-success"
          : "rounded-full border border-warning/25 bg-warning/[0.07] px-2.5 py-1 text-[10px] text-warning"
      }
    >
      {pass ? "✓" : "○"} {label}
    </span>
  );
}

function ManualTimeForm({
  technicianId,
  candidates,
  onSaved,
}: {
  technicianId: string;
  candidates: TechnicianTimeRepairCandidate[];
  onSaved: () => void;
}) {
  const [workDate, setWorkDate] = useState(() => businessTodayIsoDate());
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState<"missed_clock" | "pre_atlas" | "owner_correction">(
    "missed_clock",
  );
  const [assignmentId, setAssignmentId] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  function chooseCandidate(value: string) {
    setAssignmentId(value);
    const candidate = candidates.find((item) => item.assignmentId === value);
    if (candidate) {
      setWorkDate(candidate.visitDate);
      setReason("missed_clock");
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      const response = await fetch(
        `/api/admin/technicians/${encodeURIComponent(technicianId)}/time-entries`,
        {
          method: "POST",
          headers: getAdminRequestHeaders(),
          body: JSON.stringify({
            assignmentId: assignmentId || null,
            workDate,
            startTime,
            endTime,
            reason,
            note,
          }),
        },
      );
      const body = (await response.json().catch(() => null)) as
        | { entry?: { minutes: number }; error?: string }
        | null;
      if (!response.ok || !body?.entry) {
        throw new Error(body?.error ?? "Could not save owner-entered time.");
      }
      setSaved(`${formatHours(body.entry.minutes)} added as owner-entered time.`);
      setStartTime("");
      setEndTime("");
      setNote("");
      setAssignmentId("");
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save owner-entered time.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "min-h-12 w-full rounded-xl border border-foreground/10 bg-background/55 px-3 text-sm text-foreground outline-none focus:border-accent/40";

  return (
    <section className="rounded-[1.6rem] border border-foreground/10 bg-surface-elevated p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-accent">Labor repair</p>
          <h3 className="mt-2 text-xl font-semibold">Add missed hours</h3>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted">
            This never edits or impersonates Tyler&apos;s job clock. HQ time is stored as a separate audited source.
          </p>
        </div>
        {candidates.length ? (
          <span className="rounded-full border border-warning/25 bg-warning/[0.07] px-3 py-1 text-[10px] text-warning">
            {candidates.length} missing
          </span>
        ) : null}
      </div>

      <form onSubmit={submit} className="mt-5 space-y-4">
        <label className="block text-xs text-muted">
          Related completed job <span className="opacity-60">(optional)</span>
          <select
            value={assignmentId}
            onChange={(event) => chooseCandidate(event.target.value)}
            className={`${inputClass} mt-1`}
          >
            <option value="">General / pre-Atlas time</option>
            {candidates.map((candidate) => (
              <option key={candidate.assignmentId} value={candidate.assignmentId}>
                {candidate.visitDate} · {candidate.clientName} · {candidate.serviceTitle}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="text-xs text-muted">
            Work date
            <input type="date" required value={workDate} onChange={(event) => setWorkDate(event.target.value)} className={`${inputClass} mt-1`} />
          </label>
          <label className="text-xs text-muted">
            Actual start
            <input type="time" required value={startTime} onChange={(event) => setStartTime(event.target.value)} className={`${inputClass} mt-1`} />
          </label>
          <label className="text-xs text-muted">
            Actual end
            <input type="time" required value={endTime} onChange={(event) => setEndTime(event.target.value)} className={`${inputClass} mt-1`} />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-muted">
            Why
            <select value={reason} onChange={(event) => setReason(event.target.value as typeof reason)} className={`${inputClass} mt-1`}>
              <option value="missed_clock">Missed clock</option>
              <option value="pre_atlas">Before Atlas</option>
              <option value="owner_correction">Owner correction</option>
            </select>
          </label>
          <label className="text-xs text-muted">
            Note <span className="opacity-60">(recommended)</span>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Example: Tyler worked this before Field Pass was live"
              className={`${inputClass} mt-1`}
              maxLength={1000}
            />
          </label>
        </div>

        {assignmentId ? (
          <p className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-3 text-xs leading-relaxed text-muted">
            Enter the times you actually know. The Jobber scheduled time is intentionally not auto-filled as if it were labor evidence.
          </p>
        ) : null}
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        {saved ? <p role="status" className="text-sm text-success">{saved}</p> : null}
        <button
          type="submit"
          disabled={saving}
          className="min-h-12 w-full rounded-xl bg-accent px-4 text-sm font-semibold text-background disabled:opacity-50 sm:w-auto sm:min-w-44"
        >
          {saving ? "Saving audited time…" : "Add owner-entered time"}
        </button>
      </form>
    </section>
  );
}

function WorkdayIntegrityPanel({ profile }: { profile: TechnicianOperationalProfile }) {
  const integrity = profile.workdayIntegrity;
  return (
    <section className="rounded-[1.6rem] border border-foreground/10 bg-surface-elevated p-4 sm:p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-accent">Today · evidence integrity</p>
          <h3 className="mt-2 text-xl font-semibold">Did the day leave a clean trail?</h3>
        </div>
        <div className="text-right">
          <p className="font-serif text-4xl font-light">{integrity.percent}%</p>
          <p className="text-[10px] text-muted">{integrity.checksPassed}/{integrity.checksTotal} checks</p>
        </div>
      </div>
      {integrity.jobs.length ? (
        <div className="mt-5 space-y-3">
          {integrity.jobs.map((job) => (
            <article key={job.assignmentId} className="rounded-2xl border border-foreground/10 bg-background/30 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{job.clientName}</p>
                  <p className="mt-1 text-xs text-muted">{job.serviceTitle} · {formatDateTime(job.scheduledStart)}</p>
                </div>
                <span className="text-xs tabular-nums text-muted">{job.checksPassed}/{job.checksTotal}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <EvidenceCheck pass={job.syncState === "verified"} label="Jobber verified" />
                <EvidenceCheck pass={job.closeoutSaved} label="Closeout" />
                <EvidenceCheck pass={job.timeSource !== "missing"} label={job.timeSource === "manual" ? "Owner time" : "Clock time"} />
                <EvidenceCheck pass={job.beforePhotos > 0} label={`Before ${job.beforePhotos || ""}`.trim()} />
                <EvidenceCheck pass={job.afterPhotos > 0} label={`After ${job.afterPhotos || ""}`.trim()} />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">No HomeAtlas technician assignments are scheduled for today.</p>
      )}
    </section>
  );
}

function PhotoMemoryPanel({
  technicianId,
  profile,
  onSaved,
}: {
  technicianId: string;
  profile: TechnicianOperationalProfile;
  onSaved: () => void;
}) {
  const [workingPhotoId, setWorkingPhotoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const photos = profile.photos;

  async function setVisibility(photoId: string, customerVisible: boolean) {
    setWorkingPhotoId(photoId);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/technicians/${encodeURIComponent(technicianId)}/photos/${encodeURIComponent(photoId)}/visibility`,
        {
          method: "POST",
          headers: getAdminRequestHeaders(),
          body: JSON.stringify({ customerVisible }),
        },
      );
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? "Could not update member photo visibility.");
      onSaved();
    } catch (visibilityError) {
      setError(visibilityError instanceof Error ? visibilityError.message : "Could not update member photo visibility.");
    } finally {
      setWorkingPhotoId(null);
    }
  }

  return (
    <section className="rounded-[1.6rem] border border-foreground/10 bg-surface-elevated p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-accent">Property memory</p>
          <h3 className="mt-2 text-xl font-semibold">Before &amp; after photo history</h3>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted">
            One private Atlas archive for HomeAtlas and regular SqueegeeKing jobs. Member publication reuses the same stored image—no duplicate upload.
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-foreground/10 px-3 py-1 text-[10px] text-muted">
          {photos.length} saved
        </span>
      </div>
      {error ? <p role="alert" className="mt-4 text-sm text-danger">{error}</p> : null}
      {photos.length ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo) => (
            <article key={photo.id} className="overflow-hidden rounded-2xl border border-foreground/10 bg-background/35">
              <div
                className="aspect-[4/3] bg-foreground/[0.04] bg-cover bg-center"
                style={photo.signedUrl ? { backgroundImage: `url(${JSON.stringify(photo.signedUrl)})` } : undefined}
                role="img"
                aria-label={`${photo.captureType} photo from ${photo.serviceTitle}`}
              >
                {!photo.signedUrl ? (
                  <div className="grid h-full place-items-center text-xs text-muted">Preview unavailable</div>
                ) : null}
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full border border-accent/20 bg-accent/[0.05] px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-accent">
                    {photo.captureType}
                  </span>
                  <span className="text-[10px] text-muted">{photo.jobberBacked ? "Jobber-backed" : "HomeAtlas live"}</span>
                </div>
                <p className="mt-3 text-sm font-medium">{photo.serviceTitle}</p>
                <p className="mt-1 text-xs text-muted">{photo.visitDate} · {photo.clientName}</p>
                <p className="mt-3 text-xs leading-relaxed text-muted">
                  {photo.memberLinked
                    ? photo.customerVisible
                      ? `Visible in ${photo.propertyName || "member"} property history.`
                      : `Member linked · ready for owner publication review.`
                    : "SqueegeeKing history kept in Atlas. If this Jobber property is linked to a member later, this photo becomes publication-eligible automatically."}
                </p>
                {photo.memberLinked ? (
                  <button
                    type="button"
                    disabled={workingPhotoId === photo.id}
                    onClick={() => void setVisibility(photo.id, !photo.customerVisible)}
                    className="mt-4 min-h-11 w-full rounded-xl border border-accent/25 px-3 text-xs font-medium text-accent disabled:opacity-50"
                  >
                    {workingPhotoId === photo.id
                      ? "Saving…"
                      : photo.customerVisible
                        ? "Hide from member"
                        : photo.captureType === "after"
                          ? "Publish to member · cover eligible"
                          : "Publish to member"}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">No technician photos saved yet.</p>
      )}
    </section>
  );
}

export function TechnicianEvidenceOverlay({ technicianId }: { technicianId: string }) {
  const [unlocked] = useAdminUnlockedState();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<TechnicianOperationalProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!unlocked) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/technicians/${encodeURIComponent(technicianId)}/profile`,
        { headers: getAdminRequestHeaders(), cache: "no-store" },
      );
      const body = (await response.json().catch(() => null)) as
        | { profile?: TechnicianOperationalProfile; error?: string }
        | null;
      if (!response.ok || !body?.profile) {
        throw new Error(body?.error ?? "Could not load technician evidence.");
      }
      setProfile(body.profile);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load technician evidence.");
    } finally {
      setLoading(false);
    }
  }, [technicianId, unlocked]);

  useEffect(() => {
    if (open) void load();
  }, [load, open]);

  const badgeCount = useMemo(
    () =>
      profile
        ? profile.activity.missingTimeJobs +
          profile.activity.photoPairsMissingToday +
          profile.activity.memberPublishReadyPhotos
        : 0,
    [profile],
  );

  if (!unlocked) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[max(1rem,var(--safe-area-bottom))] right-4 z-[72] inline-flex min-h-12 items-center rounded-full border border-foreground/15 bg-[#0b0a09]/95 px-5 text-xs font-semibold text-foreground shadow-[0_18px_60px_rgba(0,0,0,.45)] backdrop-blur-xl active:scale-[0.98] sm:right-6"
      >
        Hours &amp; proof
        {badgeCount > 0 ? (
          <span className="ml-2 min-w-5 rounded-full bg-warning px-1.5 py-0.5 text-center text-[10px] text-background">
            {badgeCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[101] flex items-end bg-black/65 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6">
          <button type="button" aria-label="Close hours and proof" className="absolute inset-0" onClick={() => setOpen(false)} />
          <div className="relative max-h-[94svh] w-full overflow-y-auto rounded-t-[2rem] border border-foreground/10 bg-background p-4 pb-[max(1.5rem,var(--safe-area-bottom))] shadow-2xl sm:max-w-6xl sm:rounded-[2rem] sm:p-6">
            <div className="sticky top-0 z-20 mb-4 flex items-center justify-between gap-4 border-b border-foreground/10 bg-background/95 py-3 backdrop-blur-xl">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-accent">HQ · labor &amp; evidence</p>
                <p className="mt-1 text-sm font-semibold">{profile?.technician.displayName ?? "Technician"}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-full border border-foreground/10 px-4 text-xs text-muted">
                Done
              </button>
            </div>

            {loading && !profile ? <div className="p-12 text-center text-sm text-muted">Loading labor and photo memory…</div> : null}
            {error ? <p role="alert" className="rounded-xl border border-danger/25 bg-danger/[0.07] p-4 text-sm text-danger">{error}</p> : null}

            {profile ? (
              <div className="space-y-5">
                <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <div className="rounded-2xl border border-foreground/10 bg-surface-elevated p-4">
                    <p className="text-[9px] uppercase tracking-[0.16em] text-muted">Today recorded</p>
                    <p className="mt-2 font-serif text-3xl font-light">{formatHours(profile.activity.todayRecordedMinutes)}</p>
                    <p className="mt-2 text-[11px] text-muted">{formatHours(profile.activity.todayClockedMinutes)} clock · {formatHours(profile.activity.todayManualMinutes)} owner-entered</p>
                  </div>
                  <div className="rounded-2xl border border-foreground/10 bg-surface-elevated p-4">
                    <p className="text-[9px] uppercase tracking-[0.16em] text-muted">Missing time</p>
                    <p className="mt-2 font-serif text-3xl font-light">{profile.activity.missingTimeJobs}</p>
                    <p className="mt-2 text-[11px] text-muted">Completed jobs with no clock or owner-entered time.</p>
                  </div>
                  <div className="rounded-2xl border border-foreground/10 bg-surface-elevated p-4">
                    <p className="text-[9px] uppercase tracking-[0.16em] text-muted">Photo pairs</p>
                    <p className="mt-2 font-serif text-3xl font-light">{profile.activity.photoPairsCompleteToday}/{profile.activity.todayCloseouts}</p>
                    <p className="mt-2 text-[11px] text-muted">Completed jobs with both before + after proof.</p>
                  </div>
                  <div className="rounded-2xl border border-foreground/10 bg-surface-elevated p-4">
                    <p className="text-[9px] uppercase tracking-[0.16em] text-muted">Member review</p>
                    <p className="mt-2 font-serif text-3xl font-light">{profile.activity.memberPublishReadyPhotos}</p>
                    <p className="mt-2 text-[11px] text-muted">Private photos eligible to publish to linked members.</p>
                  </div>
                </section>

                <WorkdayIntegrityPanel profile={profile} />
                <ManualTimeForm technicianId={technicianId} candidates={profile.timeRepairCandidates} onSaved={() => void load()} />

                {profile.manualTimeEntries.length ? (
                  <section className="rounded-[1.6rem] border border-foreground/10 bg-surface-elevated p-4 sm:p-6">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-accent">Owner-entered ledger</p>
                    <h3 className="mt-2 text-xl font-semibold">Audited time history</h3>
                    <div className="mt-4 space-y-2">
                      {profile.manualTimeEntries.slice(0, 10).map((entry) => (
                        <div key={entry.id} className="flex items-start justify-between gap-4 rounded-xl border border-foreground/10 bg-background/30 p-3 text-xs">
                          <div>
                            <p className="font-medium text-foreground">{entry.workDate} · {reasonLabel(entry.reason)}</p>
                            <p className="mt-1 text-muted">{formatDateTime(entry.startedAt)} → {formatDateTime(entry.endedAt)}</p>
                            {entry.note ? <p className="mt-1 text-muted">{entry.note}</p> : null}
                          </div>
                          <span className="shrink-0 font-semibold tabular-nums">{formatHours(entry.minutes)}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                <PhotoMemoryPanel technicianId={technicianId} profile={profile} onSaved={() => void load()} />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
