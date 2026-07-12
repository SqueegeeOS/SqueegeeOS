"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { CompleteChargeVisitModal } from "@/components/admin/complete-charge-visit-modal";
import { HqFounderNav } from "@/components/admin/hq-founder-nav";
import { AmbientStage } from "@/components/craft/ambient-stage";
import { MotionReveal } from "@/components/craft/motion-reveal";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import type {
  BillingRegisterRow,
  BillingWorkspaceData,
} from "@/lib/admin/billing-workspace-types";
import { businessTodayIsoDate } from "@/lib/admin/company-business-timezone";
import { formatCurrency } from "@/lib/admin/sales-calculations";
import { isAdminUnlocked } from "@/lib/admin/pin";
import { craftEyebrow, craftHeading } from "@/lib/craft/tokens";
import { customerWorkspaceHref } from "@/lib/hq/customer-workspace/routes";

type JobGroup = "overdue" | "today" | "upcoming";

function jobDate(row: BillingRegisterRow): string | null {
  return row.nextAppointmentDate?.slice(0, 10) ?? null;
}

function groupFor(row: BillingRegisterRow, today: string): JobGroup {
  const date = jobDate(row);
  if (!date || date > today) return "upcoming";
  return date < today ? "overdue" : "today";
}

function formatJobDay(value: string | null): string {
  if (!value) return "Unscheduled";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function JobCard({
  row,
  group,
  onFinish,
}: {
  row: BillingRegisterRow;
  group: JobGroup;
  onFinish: (row: BillingRegisterRow) => void;
}) {
  const estimatedValue =
    (row.visitPrice ?? 0) + (row.enrollmentSavingsPerVisit ?? 0);

  return (
    <article className="overflow-hidden rounded-[1.75rem] border border-border/80 bg-background/70 shadow-[0_24px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4 border-b border-border/60 px-5 py-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-accent">
            {group === "today"
              ? "Today's care"
              : group === "overdue"
                ? "Needs attention"
                : "Coming up"}
          </p>
          <p className="mt-1 text-sm text-muted">
            {formatJobDay(jobDate(row))}
          </p>
        </div>
        <span className="rounded-full border border-border px-3 py-1 text-xs text-muted">
          {row.cardOnFileLabel ?? "Card on file"}
        </span>
      </div>

      <div className="space-y-5 px-5 py-5">
        <div>
          <h2 className="font-serif text-2xl font-light text-foreground">
            {row.homeownerName}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {row.propertyLabel}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-border/60 bg-foreground/[0.025] p-3">
            <p className="text-[9px] uppercase tracking-[0.16em] text-muted">Service</p>
            <p className="mt-2 text-sm text-foreground">Window care</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-foreground/[0.025] p-3">
            <p className="text-[9px] uppercase tracking-[0.16em] text-muted">Charge</p>
            <p className="mt-2 text-sm text-foreground">
              {formatCurrency(row.visitPrice ?? 0)}
            </p>
          </div>
          <div className="rounded-2xl border border-accent/20 bg-accent/[0.05] p-3">
            <p className="text-[9px] uppercase tracking-[0.16em] text-accent/70">Value</p>
            <p className="mt-2 text-sm text-accent">
              {formatCurrency(estimatedValue)}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            href={customerWorkspaceHref("property", row.propertyId)}
            className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-border px-5 text-sm text-muted transition hover:text-foreground"
          >
            Customer &amp; property
          </a>
          <button
            type="button"
            onClick={() => onFinish(row)}
            className="inline-flex min-h-[52px] flex-1 items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-background transition hover:brightness-105"
          >
            Finish job · review &amp; charge
          </button>
        </div>
        <p className="text-center text-xs leading-relaxed text-muted">
          Add extra services, adjust the charge, record savings, complete the
          visit, and collect payment in one review.
        </p>
      </div>
    </article>
  );
}

function TodayWorkspaceContent() {
  const [data, setData] = useState<BillingWorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState<BillingRegisterRow | null>(null);
  const today = businessTodayIsoDate();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/billing-workspace", {
        headers: getAdminRequestHeaders(),
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as
        | (BillingWorkspaceData & { error?: string })
        | null;
      if (!response.ok || !body) {
        throw new Error(body?.error ?? "Could not load today's work");
      }
      setData(body);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load today's work");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const jobs = useMemo(
    () =>
      (data?.rows ?? [])
        .filter((row) => Boolean(row.nextAppointmentId))
        .sort((a, b) => (jobDate(a) ?? "").localeCompare(jobDate(b) ?? "")),
    [data],
  );
  const todayJobs = jobs.filter((row) => groupFor(row, today) === "today");
  const overdueJobs = jobs.filter((row) => groupFor(row, today) === "overdue");
  const upcomingJobs = jobs.filter((row) => groupFor(row, today) === "upcoming").slice(0, 6);

  const renderGroup = (title: string, rows: BillingRegisterRow[], group: JobGroup) =>
    rows.length > 0 ? (
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className={craftEyebrow}>{title}</p>
            <h2 className="mt-2 font-serif text-2xl font-light text-foreground">
              {rows.length} job{rows.length === 1 ? "" : "s"}
            </h2>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((row) => (
            <JobCard key={row.membershipId} row={row} group={group} onFinish={setFinishing} />
          ))}
        </div>
      </section>
    ) : null;

  return (
    <AmbientStage className="min-h-screen px-4 py-8 text-foreground sm:px-6 sm:py-12">
      <div className="relative mx-auto max-w-6xl">
        <HqFounderNav />
        <MotionReveal className="mb-10 mt-10">
          <p className={craftEyebrow}>Run the day</p>
          <h1 className={`${craftHeading} mt-3 text-4xl sm:text-5xl`}>Today</h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
            Scheduled work first. Finish the job once; HomeAtlas handles services,
            add-ons, member savings, Stripe payment, and the permanent record.
          </p>
        </MotionReveal>

        {loading ? (
          <p className="text-sm text-muted">Loading today&apos;s work…</p>
        ) : error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : jobs.length === 0 ? (
          <div className="rounded-[2rem] border border-border bg-background/60 p-10 text-center">
            <p className="font-serif text-2xl text-foreground">The route is clear.</p>
            <p className="mt-3 text-sm text-muted">Schedule a member visit and it will appear here.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {renderGroup("Overdue", overdueJobs, "overdue")}
            {renderGroup("Today's route", todayJobs, "today")}
            {renderGroup("Next up", upcomingJobs, "upcoming")}
          </div>
        )}
      </div>

      {finishing ? (
        <CompleteChargeVisitModal
          row={finishing}
          onClose={() => setFinishing(null)}
          onRecorded={() => {
            void load();
          }}
        />
      ) : null}
    </AmbientStage>
  );
}

export function TodayWorkspacePage() {
  const [unlocked, setUnlocked] = useState(() => isAdminUnlocked());
  if (!unlocked) return <AdminPinGate onUnlock={() => setUnlocked(true)} />;
  return <TodayWorkspaceContent />;
}
