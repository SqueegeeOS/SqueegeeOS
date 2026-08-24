"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { AddMemberAddonButton } from "@/components/admin/add-member-addon-modal";
import { ArchiveMembershipButton } from "@/components/admin/archive-membership-modal";
import { HqFounderNav } from "@/components/admin/hq-founder-nav";
import { PaymentSetupEmailButton } from "@/components/admin/payment-setup-email-button";
import { ScheduleMembershipButton } from "@/components/admin/schedule-membership-modal";
import { AmbientStage } from "@/components/craft/ambient-stage";
import { GlassCard } from "@/components/craft/glass-card";
import { MotionReveal } from "@/components/craft/motion-reveal";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import { useAdminUnlockedState } from "@/lib/admin/use-admin-unlocked-state";
import { craftEyebrow, craftHeading } from "@/lib/craft/tokens";
import type {
  HqJobberConnectionSummary,
  HqMembershipRow,
} from "@/app/api/admin/memberships/route";

const STATUS_TONE: Record<HqMembershipRow["status"], string> = {
  active: "text-emerald-300/90",
  scheduled: "text-emerald-300/90",
  signed: "text-accent",
  "needs card": "text-amber-300/90",
  "needs scheduling": "text-amber-300/90",
  attention: "text-red-400/90",
  cancelled: "text-muted/60",
};

const STATUS_PRIORITY: Record<HqMembershipRow["status"], number> = {
  "needs scheduling": 0,
  attention: 1,
  "needs card": 2,
  signed: 3,
  active: 4,
  scheduled: 5,
  cancelled: 6,
};

function money(n: number | null): string {
  return typeof n === "number"
    ? n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
    : "unknown";
}

function formatNextService(row: HqMembershipRow): string {
  if (row.nextServiceDate) {
    const dateLabel = new Date(`${row.nextServiceDate}T12:00:00Z`).toLocaleDateString(
      "en-US",
      { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" },
    );
    const serviceLabel = row.nextServiceTimeWindow
      ? `${dateLabel} · ${row.nextServiceTimeWindow}`
      : dateLabel;
    return row.nextServiceSource === "paired_jobber_projection"
      ? `${serviceLabel} · live Jobber link`
      : serviceLabel;
  }
  if (row.nextServiceMonth) {
    const [year, month] = row.nextServiceMonth.split("-");
    if (year && month) {
      return new Date(`${year}-${month}-01T12:00:00Z`).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
    }
  }
  return "needs setup";
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <GlassCard tone="subtle" padding="sm">
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted">{label}</p>
      <p className="mt-2 font-serif text-2xl font-light tabular-nums text-foreground">{value}</p>
    </GlassCard>
  );
}

export function HqMembershipsPage() {
  const [unlocked, setUnlocked] = useAdminUnlockedState();

  if (!unlocked) {
    return <AdminPinGate onUnlock={() => setUnlocked(true)} />;
  }

  return <HqMembershipsContent />;
}

function HqMembershipsContent() {
  const [rows, setRows] = useState<HqMembershipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [totalAddonRevenue, setTotalAddonRevenue] = useState(0);
  const [jobberConnection, setJobberConnection] =
    useState<HqJobberConnectionSummary | null>(null);

  const loadMemberships = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/memberships", {
        headers: getAdminRequestHeaders(),
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as {
        rows?: HqMembershipRow[];
        totalAddonRevenue?: number;
        jobberConnection?: HqJobberConnectionSummary | null;
        error?: string;
      } | null;
      if (!response.ok) {
        const detail = body?.error ?? response.statusText;
        throw new Error(`${response.status} ${detail}`);
      }
      setRows(body?.rows ?? []);
      setTotalAddonRevenue(body?.totalAddonRevenue ?? 0);
      setJobberConnection(body?.jobberConnection ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadMemberships(), 0);
    return () => window.clearTimeout(timer);
  }, [loadMemberships]);

  const visibleRows = rows
    .filter((row) => row.rawStatus !== "cancelled")
    .sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]);
  const live = visibleRows;
  const active = live.filter(
    (r) => r.status === "active" || r.status === "scheduled" || r.status === "needs scheduling",
  );
  const needsScheduling = live.filter((r) => r.status === "needs scheduling");
  const yearly = live.reduce((sum, r) => sum + (r.yearlyValue ?? 0), 0);
  const now = new Date();
  const thisMonth = live
    .filter((r) => {
      if (!r.nextServiceMonth) return false;
      const [year, month] = r.nextServiceMonth.split("-");
      if (!year || !month) return false;
      return (
        Number(year) === now.getFullYear() &&
        Number(month) === now.getMonth() + 1
      );
    })
    .reduce((sum, r) => sum + (r.visitPrice ?? 0), 0);

  return (
    <AmbientStage className="px-4 py-10 text-foreground sm:px-6 sm:py-12">
      <div className="relative mx-auto max-w-6xl">
        <HqFounderNav />
        <MotionReveal className="mb-10 mt-10">
          <p className={craftEyebrow}>Membership command center</p>
          <h1 className={`${craftHeading} mt-3 text-3xl sm:text-4xl`}>The book of members.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-[1.65] text-muted">
            Every real membership on file, what it is worth, and who needs
            action. No projections, no demo data.
          </p>
        </MotionReveal>

        {notice ? (
          <div className="mb-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {notice}
          </div>
        ) : null}

        {jobberConnection?.status === "refresh_required" ? (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            <span>
              Jobber needs one fresh authorization. Dates below remain last-known
              until the live sync reconnects.
            </span>
            <Link
              href="/hq/jobber?returnTo=%2Fhq%2Fmemberships"
              className="font-medium text-amber-50 underline underline-offset-4"
            >
              Reconnect Jobber
            </Link>
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : visibleRows.length === 0 ? (
          <GlassCard tone="subtle" motion="rise" className="px-6 py-14 text-center">
            <p className="font-serif text-2xl font-light text-foreground/90">
              No memberships on file yet.
            </p>
            <p className="mt-3 text-sm text-muted">
              Signed agreements create membership records here automatically.
            </p>
          </GlassCard>
        ) : (
          <>
            {needsScheduling.length > 0 ? (
              <GlassCard
                tone="subtle"
                motion="rise"
                className="mb-8 border-amber-300/20 bg-amber-300/[0.045]"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-amber-200/80">
                      Scheduling reminder
                    </p>
                    <h2 className="mt-2 font-serif text-2xl font-light text-foreground">
                      {needsScheduling.length} existing member
                      {needsScheduling.length === 1 ? " needs" : "s need"} a visit booked.
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
                      These active memberships do not have a matched, verified Jobber visit yet.
                      This queue refreshes automatically after the daily Jobber sync.
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-emerald-300/20 bg-emerald-300/[0.05] px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-emerald-200/80">
                    Jobber auto-sync on
                  </span>
                </div>
                <div className="mt-5 grid gap-3 border-t border-amber-300/10 pt-5 sm:grid-cols-2">
                  {needsScheduling.map((row) => (
                    <div
                      key={row.id}
                      className="flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-background/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {row.customerName}
                        </p>
                        <p className="mt-1 truncate text-xs text-muted">{row.address}</p>
                      </div>
                      <ScheduleMembershipButton
                        row={row}
                        onScheduled={(message) => {
                          setNotice(message);
                          void loadMemberships();
                        }}
                      />
                    </div>
                  ))}
                </div>
              </GlassCard>
            ) : null}

            <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
              <Stat label="Active" value={String(active.length)} />
              <Stat label="Needs scheduling" value={String(needsScheduling.length)} />
              <Stat label="Yearly value" value={money(yearly)} />
              <Stat label="This month" value={thisMonth > 0 ? money(thisMonth) : "—"} />
              <Stat label="Add-on revenue" value={totalAddonRevenue > 0 ? money(totalAddonRevenue) : "—"} />
              <Stat label="Bi-Annual" value={String(live.filter((r) => r.tier === "biannual").length)} />
              <Stat label="Quarterly" value={String(live.filter((r) => r.tier === "quarterly").length)} />
            </div>

            <div className="space-y-5">
              {visibleRows.map((row, index) => (
                <GlassCard key={row.id} tone="subtle" motion="rise" index={index}>
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">
                        {row.customerName}
                        {row.founding && (
                          <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
                            Founding
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-sm text-muted">{row.address}</p>
                    </div>
                    <span
                      className={`font-mono text-[11px] uppercase tracking-[0.18em] ${STATUS_TONE[row.status]}`}
                    >
                      {row.status}
                    </span>
                  </div>
                  <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border/30 pt-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
                    {(
                      [
                        ["Plan", row.planLabel],
                        ["Visit price", money(row.visitPrice)],
                        ["Visits / yr", row.visitsPerYear ? String(row.visitsPerYear) : "unknown"],
                        ["Yearly value", money(row.yearlyValue)],
                        ["Add-on revenue", money(row.lifetimeAddonRevenue)],
                        ["Member savings", money(row.lifetimeMemberSavings)],
                        [
                          "Payment",
                          row.paymentRail === "manual_cash_check"
                            ? "Cash / check"
                            : row.cardOnFile
                              ? "Stripe card on file"
                              : "Stripe setup needed",
                        ],
                        ["Next service", formatNextService(row)],
                      ] as Array<[string, string]>
                    ).map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-[10px] uppercase tracking-[0.16em] text-muted/80">{k}</dt>
                        <dd className="mt-1 text-foreground/90">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-border/30 pt-4">
                    {row.portalPath ? (
                      <Link
                        href={row.portalPath}
                        className="text-xs text-accent underline-offset-2 hover:underline"
                      >
                        Open portal
                      </Link>
                    ) : (
                      <span className="text-xs text-muted/60">Portal: needs setup</span>
                    )}
                    <span className="text-xs text-muted/60">
                      {row.paymentRail === "manual_cash_check"
                        ? "Owner-approved cash/check account"
                        : `Stripe: ${row.stripeCustomer ? "customer linked" : "not linked"}`}
                    </span>
                    {row.agreementId ? (
                      <span className="font-mono text-xs text-muted/60">
                        Agreement {row.agreementId.slice(0, 8)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted/60">Agreement: unknown</span>
                    )}
                    {!row.cardOnFile && row.paymentRail === "stripe_card" ? (
                      <PaymentSetupEmailButton
                        membershipId={row.id}
                        canSend={Boolean(row.agreementId)}
                        onAccepted={(message) => {
                          setNotice(message);
                          void loadMemberships();
                        }}
                      />
                    ) : null}
                    <AddMemberAddonButton
                      row={row}
                      onRecorded={(message) => {
                        setNotice(message);
                        void loadMemberships();
                      }}
                    />
                    <ScheduleMembershipButton
                      row={row}
                      onScheduled={(message) => {
                        setNotice(message);
                        void loadMemberships();
                      }}
                    />
                    <ArchiveMembershipButton
                      row={row}
                      onArchived={(message) => {
                        setNotice(message);
                        void loadMemberships();
                      }}
                    />
                  </div>
                </GlassCard>
              ))}
            </div>
          </>
        )}
      </div>
    </AmbientStage>
  );
}
