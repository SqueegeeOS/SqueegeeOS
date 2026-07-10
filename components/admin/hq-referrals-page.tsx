"use client";

import { useEffect, useState } from "react";
import { HqFounderNav } from "@/components/admin/hq-founder-nav";
import { AmbientStage } from "@/components/craft/ambient-stage";
import { GlassCard } from "@/components/craft/glass-card";
import { MotionReveal } from "@/components/craft/motion-reveal";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import { craftEyebrow, craftHeading } from "@/lib/craft/tokens";
import type { HqReferralRow, ReferralStatus } from "@/lib/referrals/types";

const STATUS_TONE: Record<ReferralStatus, string> = {
  pending: "text-muted",
  converted: "text-emerald-300/90",
  rewarded: "text-accent",
  expired: "text-muted/50",
  cancelled: "text-muted/50",
};

export function HqReferralsPage() {
  const [rows, setRows] = useState<HqReferralRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/referrals", { headers: getAdminRequestHeaders(), cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load referrals");
        const data = (await r.json()) as { rows: HqReferralRow[] };
        setRows(data.rows);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AmbientStage className="px-4 py-10 text-foreground sm:px-6 sm:py-12">
      <div className="relative mx-auto max-w-5xl">
        <HqFounderNav />
        <MotionReveal className="mb-10 mt-10">
          <p className={craftEyebrow}>Member growth</p>
          <h1 className={`${craftHeading} mt-3 text-3xl sm:text-4xl`}>Referrals</h1>
          <p className="mt-4 max-w-2xl text-sm leading-[1.65] text-muted">
            Every member&apos;s referral link, who it brought in, and where each
            referral stands. Rewards are applied manually for now.
          </p>
        </MotionReveal>

        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : rows.length === 0 ? (
          <GlassCard tone="subtle" motion="rise" className="px-6 py-14 text-center">
            <p className="font-serif text-2xl font-light text-foreground/90">
              No referral activity yet.
            </p>
            <p className="mt-3 text-sm text-muted">
              Codes appear here the first time a member opens the referral
              section of their portal.
            </p>
          </GlassCard>
        ) : (
          <div className="space-y-6">
            {rows.map((row, index) => (
              <GlassCard key={row.code} tone="subtle" motion="rise" index={index}>
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{row.memberName}</p>
                    <p className="mt-1 font-mono text-xs tracking-[0.14em] text-accent">
                      /r/{row.code}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xs tracking-[0.14em] text-muted">
                      {row.visitCount} link {row.visitCount === 1 ? "visit" : "visits"}
                    </p>
                    <p className="mt-1 font-mono text-xs tracking-[0.14em] text-muted">
                      {row.convertedCount} converted member
                      {row.convertedCount === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>

                {(row.nextMilestoneLabel || row.availableCareCreditLabel) && (
                  <div className="mt-4 space-y-2 rounded-xl border border-border/60 bg-foreground/[0.02] px-4 py-3">
                    {row.availableCareCreditLabel ? (
                      <p className="text-sm text-accent">{row.availableCareCreditLabel}</p>
                    ) : null}
                    {row.nextMilestoneLabel ? (
                      <p className="text-sm text-muted">
                        Next milestone:{" "}
                        <span className="text-foreground/85">{row.nextMilestoneLabel}</span>
                      </p>
                    ) : null}
                    {row.availableRewardCount > 0 ? (
                      <p className="text-xs text-muted">
                        {row.availableRewardCount} reward
                        {row.availableRewardCount === 1 ? "" : "s"} awaiting redemption
                      </p>
                    ) : null}
                  </div>
                )}
                {row.referrals.length > 0 ? (
                  <ul className="mt-5 divide-y divide-border/30 border-t border-border/30">
                    {row.referrals.map((r) => (
                      <li
                        key={r.id}
                        className="grid gap-1 py-3 sm:grid-cols-[1fr_1fr_auto] sm:items-baseline sm:gap-4"
                      >
                        <span className="text-sm text-foreground/90">{r.leadName}</span>
                        <span className="truncate text-xs text-muted">{r.leadEmail}</span>
                        <span
                          className={`font-mono text-[11px] uppercase tracking-[0.18em] ${STATUS_TONE[r.status]}`}
                        >
                          {r.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-muted">
                    Link created, no requests yet.
                  </p>
                )}
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </AmbientStage>
  );
}
