"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { HqFounderNav } from "@/components/admin/hq-founder-nav";
import { MembershipMemberTable } from "@/components/admin/membership-member-table";
import { AmbientStage } from "@/components/craft/ambient-stage";
import { GlassCard } from "@/components/craft/glass-card";
import { MotionReveal } from "@/components/craft/motion-reveal";
import { ShimmerBlock } from "@/components/motion/shimmer-block";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import type { MembershipCommandCenterData } from "@/lib/admin/membership-command-center-types";
import { formatCurrency } from "@/lib/admin/sales-calculations";
import { isAdminUnlocked } from "@/lib/admin/pin";
import { craftEyebrow, craftHeading } from "@/lib/craft/tokens";

function LoadingShell() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-border/80 bg-background/40 p-5"
          >
            <ShimmerBlock className="h-3 w-24 rounded-full" />
            <ShimmerBlock className="mt-4 h-8 w-16 rounded-full" />
          </div>
        ))}
      </div>
      <GlassCard tone="subtle" padding="lg" motion="none">
        <ShimmerBlock className="h-4 w-48 rounded-full" />
        <ShimmerBlock className="mt-6 h-40 w-full rounded-2xl" />
      </GlassCard>
    </div>
  );
}

function SummaryMetrics({
  data,
}: {
  data: MembershipCommandCenterData;
}) {
  const metrics = [
    { label: "Active members", value: String(data.summary.activeCount) },
    { label: "Pending", value: String(data.summary.pendingCount) },
    { label: "Needs card", value: String(data.summary.needsCardCount) },
    {
      label: "Due this month",
      value: String(data.summary.dueThisMonthCount),
      accent: data.summary.dueThisMonthCount > 0,
    },
    {
      label: "Past due",
      value: String(data.summary.pastDueCount),
      accent: data.summary.pastDueCount > 0,
    },
    {
      label: "Needs scheduling",
      value: String(data.summary.needsSchedulingCount),
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {metrics.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border border-border/80 bg-background/40 p-5"
        >
          <p className={craftEyebrow}>{item.label}</p>
          <p
            className={`mt-2 font-serif text-3xl font-light tabular-nums ${
              item.accent ? "text-accent" : "text-foreground"
            }`}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function MonthViewSection({
  monthView,
}: {
  monthView: MembershipCommandCenterData["monthView"];
}) {
  const planBreakdown = [
    { label: "Quarterly visits", value: monthView.visitsByPlanType.quarterly },
    { label: "Bi-Annual visits", value: monthView.visitsByPlanType.biannual },
    { label: "Unknown plan", value: monthView.visitsByPlanType.unknown },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border/80 bg-background/40 p-5">
          <p className={craftEyebrow}>Members due</p>
          <p className="mt-2 font-serif text-3xl font-light tabular-nums text-foreground">
            {monthView.membersDueCount}
          </p>
          <p className="mt-2 text-xs text-muted">{monthView.referenceMonthLabel}</p>
        </div>
        <div className="rounded-2xl border border-border/80 bg-background/40 p-5">
          <p className={craftEyebrow}>Expected revenue</p>
          <p className="mt-2 font-serif text-3xl font-light tabular-nums text-accent">
            {formatCurrency(monthView.expectedRevenue)}
          </p>
          <p className="mt-2 text-xs text-muted">Visit charges due this month</p>
        </div>
        {planBreakdown.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-border/80 bg-background/40 p-5"
          >
            <p className={craftEyebrow}>{item.label}</p>
            <p className="mt-2 font-serif text-3xl font-light tabular-nums text-foreground">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {monthView.missingDataFlags.length > 0 ? (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-sm text-amber-100/90">
          <p className="text-[10px] uppercase tracking-[0.16em] text-amber-200/80">
            Data gaps
          </p>
          <ul className="mt-2 space-y-1">
            {monthView.missingDataFlags.map((flag) => (
              <li key={flag}>· {flag}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {monthView.dueMembers.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border/70 text-[10px] uppercase tracking-[0.16em] text-muted">
                <th className="pb-3 pr-4 font-medium">Customer</th>
                <th className="pb-3 pr-4 font-medium">Property</th>
                <th className="pb-3 pr-4 font-medium">Plan</th>
                <th className="pb-3 pr-4 font-medium">Visit price</th>
                <th className="pb-3 font-medium">Flags</th>
              </tr>
            </thead>
            <tbody>
              {monthView.dueMembers.map((row) => (
                <tr
                  key={row.membershipId}
                  className="border-b border-border/40 align-top"
                >
                  <td className="py-3 pr-4">{row.homeownerName}</td>
                  <td className="py-3 pr-4 text-muted">{row.propertyLabel}</td>
                  <td className="py-3 pr-4">{row.planType}</td>
                  <td className="py-3 pr-4 tabular-nums">
                    {row.visitPrice != null
                      ? formatCurrency(row.visitPrice)
                      : "—"}
                  </td>
                  <td className="py-3 text-muted">
                    {row.missingFlags.length > 0
                      ? row.missingFlags.join(" · ")
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted">
          No active members are due for service this month yet.
        </p>
      )}
    </div>
  );
}

function CommandCenterContent() {
  const [data, setData] = useState<MembershipCommandCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/membership-command-center", {
        headers: getAdminRequestHeaders(),
        cache: "no-store",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to load membership command center");
      }
      const workspace = (await response.json()) as MembershipCommandCenterData;
      setData(workspace);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load membership command center",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <AmbientStage className="px-4 py-10 text-foreground sm:px-6 sm:py-12">
      <div className="relative mx-auto max-w-7xl">
        <HqFounderNav />

        <MotionReveal className="mb-10 mt-10">
          <p className={craftEyebrow}>Headquarters</p>
          <h1 className={craftHeading}>
            Membership Revenue &amp; Service Command Center
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
            Live membership state — who is active, who needs action, and how much
            revenue is coming this month. All figures come from Supabase; empty
            fields stay blank.
          </p>
        </MotionReveal>

        {loading ? <LoadingShell /> : null}

        {!loading && error ? (
          <GlassCard tone="subtle" padding="lg" motion="none">
            <p className="text-sm text-red-300">{error}</p>
            <button
              type="button"
              onClick={() => void loadData()}
              className="mt-4 text-sm text-accent underline-offset-4 hover:underline"
            >
              Try again
            </button>
          </GlassCard>
        ) : null}

        {!loading && !error && data ? (
          <div className="space-y-8">
            {!data.connected ? (
              <GlassCard tone="subtle" padding="lg" motion="none">
                <p className="text-sm text-muted">
                  Supabase is not connected. Connect cloud persistence to see live
                  membership data.
                </p>
              </GlassCard>
            ) : null}

            <SummaryMetrics data={data} />

            <GlassCard tone="subtle" padding="lg" motion="none">
              <p className={craftEyebrow}>This month</p>
              <h2 className="mt-2 font-serif text-2xl font-light text-foreground">
                Service &amp; revenue view
              </h2>
              <div className="mt-6">
                <MonthViewSection monthView={data.monthView} />
              </div>
            </GlassCard>

            <GlassCard tone="subtle" padding="lg" motion="none">
              <p className={craftEyebrow}>Active roster</p>
              <h2 className="mt-2 font-serif text-2xl font-light text-foreground">
                Active members
              </h2>
              <div className="mt-6">
                <MembershipMemberTable rows={data.activeMembers} variant="active" />
              </div>
            </GlassCard>

            <GlassCard tone="subtle" padding="lg" motion="none">
              <p className={craftEyebrow}>Pipeline</p>
              <h2 className="mt-2 font-serif text-2xl font-light text-foreground">
                Pending members
              </h2>
              <p className="mt-2 text-sm text-muted">
                Signed but missing card, card added but not active, or agreement
                presented but not signed.
              </p>
              <div className="mt-6">
                <MembershipMemberTable
                  rows={data.pendingMembers}
                  variant="pending"
                />
              </div>
            </GlassCard>

            {data.loadedAt ? (
              <p className="text-xs text-muted/70">
                Loaded {new Date(data.loadedAt).toLocaleString()}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </AmbientStage>
  );
}

export function MembershipCommandCenterPage() {
  const [unlocked, setUnlocked] = useState(() => isAdminUnlocked());

  if (!unlocked) {
    return <AdminPinGate onUnlock={() => setUnlocked(true)} />;
  }

  return <CommandCenterContent />;
}
