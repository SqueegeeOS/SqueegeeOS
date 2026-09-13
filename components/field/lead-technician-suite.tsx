import Link from "next/link";
import { AmbientStage } from "@/components/craft/ambient-stage";
import type { TechnicianOperationalProfile } from "@/lib/field-operations/technician-profile";
import {
  craftPrimaryButton,
  craftSecondaryButton,
} from "@/lib/craft/tokens";

function formatHours(minutes: number): string {
  if (minutes <= 0) return "0h";
  const hours = minutes / 60;
  return `${hours.toFixed(hours >= 10 ? 1 : 2)}h`;
}

function formatDate(value: string | null): string {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not scheduled";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatCalendarDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-[1.25rem] border border-foreground/10 bg-foreground/[0.035] p-4">
      <p className="text-[9px] uppercase tracking-[0.19em] text-muted">{label}</p>
      <p className="mt-2 font-serif text-3xl font-light tracking-[-0.035em] text-foreground">
        {value}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-muted">{detail}</p>
    </div>
  );
}

function Check({ complete, children }: { complete: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2 text-xs text-foreground/75">
      <span
        aria-hidden="true"
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] ${
          complete
            ? "border-success/35 bg-success/[0.09] text-success"
            : "border-foreground/15 bg-foreground/[0.03] text-muted"
        }`}
      >
        {complete ? "✓" : "·"}
      </span>
      {children}
    </li>
  );
}

export function LeadTechnicianSuite({
  profile,
}: {
  profile: TechnicianOperationalProfile;
}) {
  const firstName = profile.technician.displayName.split(/\s+/)[0] ?? "Lead Tech";
  const nextWeek = profile.capacity?.weeks[0] ?? null;
  const completedToday = profile.activity.todayCloseouts;
  const totalToday = profile.activity.todayAssignments;
  const integrity = profile.workdayIntegrity;
  const competencies = profile.readiness?.competencies ?? [];

  return (
    <AmbientStage founding className="min-h-[100svh] px-4 py-6 pb-32 text-foreground sm:px-6 sm:py-10">
      <main className="mx-auto max-w-3xl">
        <header className="overflow-hidden rounded-[2rem] border border-accent/25 bg-surface-elevated p-5 shadow-[var(--shadow-float)] sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.23em] text-accent">
                HomeAtlas · Lead Tech Suite
              </p>
              <h1 className="mt-3 font-serif text-4xl font-light tracking-[-0.045em] sm:text-5xl">
                {firstName}&apos;s field command.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
                Your route, property intelligence, quality proof, time, and team
                wins—organized around the work you own.
              </p>
            </div>
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-accent/30 bg-accent/[0.08] font-serif text-lg text-accent">
              {profile.technician.displayName
                .split(/\s+/)
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-foreground/10 pt-5">
            <span className="rounded-full border border-success/30 bg-success/[0.08] px-3 py-1.5 text-[11px] text-success">
              {profile.technician.roleTitle}
            </span>
            <span className="rounded-full border border-foreground/10 bg-foreground/[0.035] px-3 py-1.5 text-[11px] text-muted">
              Private field access
            </span>
          </div>
        </header>

        <section className="mt-5 grid gap-3 sm:grid-cols-3" aria-label="Lead technician actions">
          <Link href="/tech" className={craftPrimaryButton}>
            Run today&apos;s route
          </Link>
          <Link href="/tech#upcoming-jobs" className={craftSecondaryButton}>
            Look ahead
          </Link>
          <Link href="/tech/refer" className={craftSecondaryButton}>
            Send a referral
          </Link>
        </section>

        <section className="mt-7">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-accent">Today</p>
              <h2 className="mt-2 text-2xl font-semibold">Your field pulse</h2>
            </div>
            <span className="text-xs text-muted">
              {completedToday}/{totalToday} closed
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Assigned" value={totalToday} detail="Stops owned today." />
            <Metric label="Closed" value={completedToday} detail="Closeouts safely saved." />
            <Metric
              label="Time"
              value={formatHours(profile.activity.todayRecordedMinutes)}
              detail="Clocked and approved time."
            />
            <Metric
              label="Proof"
              value={`${profile.activity.photoPairsCompleteToday}/${completedToday}`}
              detail="Before-and-after sets."
            />
          </div>
        </section>

        <section className="mt-7 rounded-[2rem] border border-foreground/10 bg-surface-elevated p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-accent">
                Workday quality
              </p>
              <h2 className="mt-2 text-2xl font-semibold">Clean handoff score</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                A complete job has verified assignment, time, before-and-after
                proof, and a saved closeout.
              </p>
            </div>
            <div className="text-right">
              <p className="font-serif text-4xl font-light text-accent">{integrity.percent}%</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted">
                {integrity.checksPassed}/{integrity.checksTotal} checks
              </p>
            </div>
          </div>

          {integrity.jobs.length ? (
            <div className="mt-5 space-y-3">
              {integrity.jobs.map((job) => (
                <article
                  key={job.assignmentId}
                  className="rounded-[1.2rem] border border-foreground/10 bg-background/35 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{job.clientName}</p>
                      <p className="mt-1 text-xs text-muted">
                        {job.serviceTitle} · {formatDate(job.scheduledStart)}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-accent">
                      {job.checksPassed}/{job.checksTotal}
                    </span>
                  </div>
                  <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                    <Check complete={job.syncState === "verified"}>Schedule verified</Check>
                    <Check complete={job.timeSource !== "missing"}>Time recorded</Check>
                    <Check complete={job.beforePhotos > 0}>Before photo</Check>
                    <Check complete={job.afterPhotos > 0}>After photo</Check>
                    <Check complete={job.closeoutSaved}>Closeout saved</Check>
                  </ul>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-[1.2rem] border border-foreground/10 bg-background/30 p-4 text-sm text-muted">
              No assigned stops today. Your scorecard will build automatically
              when HQ assigns work.
            </p>
          )}
        </section>

        <section className="mt-7 grid gap-4 sm:grid-cols-2">
          <div className="rounded-[2rem] border border-foreground/10 bg-surface-elevated p-5 sm:p-6">
            <p className="text-[10px] uppercase tracking-[0.2em] text-accent">
              Rolling {profile.activity.windowDays} days
            </p>
            <h2 className="mt-2 text-xl font-semibold">Your production</h2>
            <dl className="mt-5 grid grid-cols-2 gap-3">
              <div><dt className="text-[10px] uppercase tracking-[0.14em] text-muted">Assignments</dt><dd className="mt-1 text-2xl font-semibold">{profile.activity.assignments}</dd></div>
              <div><dt className="text-[10px] uppercase tracking-[0.14em] text-muted">Closeouts</dt><dd className="mt-1 text-2xl font-semibold">{profile.activity.closeouts}</dd></div>
              <div><dt className="text-[10px] uppercase tracking-[0.14em] text-muted">Recorded</dt><dd className="mt-1 text-2xl font-semibold">{formatHours(profile.activity.recordedMinutes)}</dd></div>
              <div><dt className="text-[10px] uppercase tracking-[0.14em] text-muted">Follow-ups</dt><dd className="mt-1 text-2xl font-semibold">{profile.activity.followUpCloseouts}</dd></div>
            </dl>
          </div>

          <div className="rounded-[2rem] border border-foreground/10 bg-surface-elevated p-5 sm:p-6">
            <p className="text-[10px] uppercase tracking-[0.2em] text-accent">Coming up</p>
            <h2 className="mt-2 text-xl font-semibold">Production load</h2>
            {nextWeek ? (
              <div className="mt-5">
                <p className="text-sm font-medium text-foreground">
                  Week of {formatCalendarDate(nextWeek.weekStart)}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{nextWeek.detail}</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Metric label="Stops" value={nextWeek.scheduledStops ?? "—"} detail="Currently assigned." />
                  <Metric label="Booked" value={nextWeek.scheduledMinutes == null ? "—" : formatHours(nextWeek.scheduledMinutes)} detail="Planned field time." />
                </div>
              </div>
            ) : (
              <p className="mt-5 text-sm text-muted">Upcoming capacity will appear after HQ assigns the route.</p>
            )}
          </div>
        </section>

        <section className="mt-7 rounded-[2rem] border border-foreground/10 bg-surface-elevated p-5 sm:p-7">
          <p className="text-[10px] uppercase tracking-[0.2em] text-accent">Lead standard</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">Field mastery</h2>
            <span className="text-xs text-muted">
              {profile.readiness?.independentCompetencyCount ?? 0}/{competencies.length || 8} independent
            </span>
          </div>
          {competencies.length ? (
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {competencies.map((competency) => {
                const rating = competency.latestAssessment?.rating ?? "learning";
                const independent = rating === "independent";
                return (
                  <li key={competency.id} className="rounded-[1.15rem] border border-foreground/10 bg-background/30 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{competency.label}</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted">{competency.detail}</p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] ${independent ? "border-success/30 bg-success/[0.08] text-success" : "border-warning/25 bg-warning/[0.07] text-warning"}`}>
                        {independent ? "Independent" : "Building"}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-5 text-sm text-muted">Your field standards will appear as HomeAtlas records verified work.</p>
          )}
        </section>

        <section className="mt-7 rounded-[1.5rem] border border-accent/20 bg-accent/[0.055] p-5">
          <p className="text-sm font-medium text-foreground">Need HQ?</p>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Flag follow-up inside the job when something needs owner attention.
            For access trouble, use the reconnect text from the sign-in screen.
          </p>
        </section>
      </main>
    </AmbientStage>
  );
}
