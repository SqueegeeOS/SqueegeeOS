"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { HqFounderNav } from "@/components/admin/hq-founder-nav";
import { AmbientStage } from "@/components/craft/ambient-stage";
import { GlassCard } from "@/components/craft/glass-card";
import { MotionReveal } from "@/components/craft/motion-reveal";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import { isAdminUnlocked } from "@/lib/admin/pin";
import { craftEyebrow, craftHeading } from "@/lib/craft/tokens";
import type { HqMembershipRow } from "@/app/api/admin/memberships/route";

const STATUS_TONE: Record<HqMembershipRow["status"], string> = {
  active: "text-emerald-300/90",
  signed: "text-accent",
  "needs card": "text-amber-300/90",
  "needs scheduling": "text-amber-300/90",
  attention: "text-red-400/90",
  cancelled: "text-muted/60",
};

function money(n: number | null): string {
  return typeof n === "number"
    ? n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
    : "unknown";
}

function serviceMonth(iso: string | null): string {
  if (!iso) return "needs setup";
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  } catch {
    return "unknown";
  }
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
  const [unlocked, setUnlocked] = useState(() => isAdminUnlocked());

  if (!unlocked) {
    return <AdminPinGate onUnlock={() => setUnlocked(true)} />;
  }

  return <HqMembershipsContent />;
}

function HqMembershipsContent() {
  const [rows, setRows] = useState<HqMembershipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/memberships", { headers: getAdminRequestHeaders(), cache: "no-store" })
      .then(async (r) => {
        const body = (await r.json().catch(() => null)) as {
          rows?: HqMembershipRow[];
          error?: string;
        } | null;
        if (!r.ok) {
          const detail = body?.error ?? r.statusText;
          throw new Error(`${r.status} ${detail}`);
        }
        setRows(body?.rows ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const live = rows.filter((r) => r.status !== "cancelled");
  const active = live.filter((r) => r.status === "active" || r.status === "needs scheduling");
  const pending = live.filter((r) => r.status === "signed" || r.status === "needs card");
  const yearly = live.reduce((sum, r) => sum + (r.yearlyValue ?? 0), 0);
  const now = new Date();
  const thisMonth = live
    .filter((r) => {
      if (!r.nextServiceMonth) return false;
      const d = new Date(r.nextServiceMonth);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
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

        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : rows.length === 0 ? (
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
            <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="Active" value={String(active.length)} />
              <Stat label="Pending" value={String(pending.length)} />
              <Stat label="Yearly value" value={money(yearly)} />
              <Stat label="This month" value={thisMonth > 0 ? money(thisMonth) : "—"} />
              <Stat label="Bi-Annual" value={String(live.filter((r) => r.tier === "biannual").length)} />
              <Stat label="Quarterly" value={String(live.filter((r) => r.tier === "quarterly").length)} />
            </div>

            <div className="space-y-5">
              {rows.map((row, index) => (
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
                        ["Card on file", row.cardOnFile ? "Yes" : "needs setup"],
                        ["Next service", serviceMonth(row.nextServiceMonth)],
                      ] as Array<[string, string]>
                    ).map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-[10px] uppercase tracking-[0.16em] text-muted/80">{k}</dt>
                        <dd className="mt-1 text-foreground/90">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-5 flex flex-wrap gap-4 border-t border-border/30 pt-4">
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
                      Stripe: {row.stripeCustomer ? "customer linked" : "not linked"}
                    </span>
                    {row.agreementId ? (
                      <span className="font-mono text-xs text-muted/60">
                        Agreement {row.agreementId.slice(0, 8)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted/60">Agreement: unknown</span>
                    )}
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
