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

const REWARD_LIFECYCLE_LABEL: Record<string, string> = {
  earned: "Earned · awaiting member claim",
  available: "Claimed · spendable Care Credit",
  redeemed: "Redeemed",
  expired: "Expired",
};

function formatHqDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

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
              Codes issue automatically when a membership activates. Legacy
              active members without codes get theirs via the backfill.
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

                {row.rewardsOutOfSync ? (
                  <div className="mt-4 rounded-xl border border-amber-400/40 bg-amber-400/[0.06] px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-amber-300">
                      Reward issuance out of sync
                    </p>
                    <p className="mt-1 text-sm text-foreground/80">
                      Reached milestones missing reward rows:{" "}
                      {row.missingMilestoneLabels.join(", ")}. Conversions are
                      recorded; issuance needs reconciliation.
                    </p>
                  </div>
                ) : null}

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
                  </div>
                )}

                {row.rewards.length > 0 ? (
                  <div className="mt-4 rounded-xl border border-border/60 bg-foreground/[0.02] px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted">
                      Reward lifecycle
                    </p>
                    <ul className="mt-2 space-y-2">
                      {row.rewards.map((reward) => (
                        <li
                          key={reward.id}
                          className="flex flex-wrap items-baseline justify-between gap-2 text-sm"
                        >
                          <span className="text-foreground/85">{reward.label}</span>
                          <span className="text-xs text-muted">
                            {REWARD_LIFECYCLE_LABEL[reward.status] ?? reward.status}
                            {reward.claimedAt
                              ? ` · claimed ${formatHqDate(reward.claimedAt)}`
                              : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {row.claimEvents.length > 0 ? (
                      <div className="mt-3 border-t border-border/40 pt-3">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-muted">
                          Claim ledger
                        </p>
                        <ul className="mt-2 space-y-1">
                          {row.claimEvents.map((event) => (
                            <li
                              key={event.id}
                              className="flex flex-wrap items-baseline justify-between gap-2 font-mono text-[11px] text-muted"
                            >
                              <span className="uppercase tracking-[0.14em]">
                                {event.eventType} · $
                                {(event.amountCents / 100).toLocaleString("en-US", {
                                  maximumFractionDigits: 0,
                                })}{" "}
                                · {event.actorType}
                              </span>
                              <span>{formatHqDate(event.createdAt)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
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
