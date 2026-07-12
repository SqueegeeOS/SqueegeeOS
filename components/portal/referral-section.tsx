"use client";

import { useCallback, useEffect, useState } from "react";
import { PortalCard, PortalSection } from "@/components/portal/portal-section";
import { REFERRAL_MILESTONES } from "@/lib/referrals/milestones";
import type { MemberReferralSummary, ReferralStatus } from "@/lib/referrals/types";

const STATUS_LABEL: Record<ReferralStatus, string> = {
  pending: "Requested a plan",
  converted: "Became a member",
  rewarded: "Reward applied",
  expired: "Expired",
  cancelled: "Cancelled",
};

const STATUS_TONE: Record<ReferralStatus, string> = {
  pending: "text-foreground/60",
  converted: "text-emerald-300/90",
  rewarded: "text-accent",
  expired: "text-foreground/40",
  cancelled: "text-foreground/40",
};

const REWARD_STATUS_LABEL = {
  earned: "Earned",
  available: "Available",
  redeemed: "Redeemed",
  expired: "Expired",
} as const;

function formatDate(value: string): string {
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

/**
 * Member Referral Rewards — shareable link, milestones, and Care Credits.
 * Renders nothing until the summary loads; hides when cloud persistence is off.
 */
export function ReferralSection({
  portalToken,
  index,
}: {
  portalToken: string;
  index: number;
}) {
  const [summary, setSummary] = useState<MemberReferralSummary | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/referrals/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portalToken }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { summary: MemberReferralSummary | null } | null) => {
        if (!cancelled) setSummary(data?.summary ?? null);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [portalToken]);

  const copyLink = useCallback(() => {
    if (!summary) return;
    void navigator.clipboard
      .writeText(summary.link)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2200);
      })
      .catch(() => undefined);
  }, [summary]);

  if (!loaded || !summary) return null;

  return (
    <PortalSection
      id="referrals"
      index={index}
      eyebrow="Member referral rewards"
      headline="Refer homes into the Care Network."
      support="When a neighbor becomes a member, you earn HomeAtlas Care Credits and milestone rewards."
    >
      <PortalCard className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="min-w-0 flex-1 truncate rounded-full border border-border bg-[var(--glass-bg-subtle)] px-4 py-3 font-mono text-sm text-foreground/85">
            {summary.link}
          </p>
          <button
            type="button"
            onClick={copyLink}
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full bg-accent px-6 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--on-accent)] transition-opacity hover:opacity-90 touch-manipulation"
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>

        <dl className="grid grid-cols-3 gap-3 border-t border-border pt-5 text-center">
          {[
            ["Link visits", summary.visitCount],
            ["Requests", summary.referralCount],
            ["Members joined", summary.convertedCount],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <dt className="text-[10px] uppercase tracking-[0.2em] text-foreground/50">
                {label}
              </dt>
              <dd className="mt-1 font-serif text-2xl font-light tabular-nums text-foreground">
                {value}
              </dd>
            </div>
          ))}
        </dl>

        {summary.availableCareCreditLabel ? (
          <p className="rounded-xl border border-accent/25 bg-accent/[0.07] px-4 py-3 text-sm leading-relaxed text-accent">
            {summary.availableCareCreditLabel}
          </p>
        ) : null}

        {summary.nextMilestone ? (
          <div className="rounded-xl border border-border/70 bg-foreground/[0.02] px-4 py-4">
            <p className="text-[10px] uppercase tracking-[0.22em] text-foreground/45">
              Next milestone
            </p>
            <p className="mt-2 font-serif text-lg text-foreground">
              {summary.nextMilestone.label}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-foreground/55">
              {summary.nextMilestone.description}
            </p>
            <p className="mt-3 text-xs text-foreground/45">
              {summary.convertedCount} of {summary.nextMilestone.convertedCount}{" "}
              converted member referrals
            </p>
          </div>
        ) : null}

        <div className="border-t border-border pt-5">
          <p className="text-[10px] uppercase tracking-[0.22em] text-foreground/45">
            Referral milestones
          </p>
          <ul className="mt-4 space-y-3">
            {REFERRAL_MILESTONES.map((milestone) => {
              const reached = summary.convertedCount >= milestone.convertedCount;
              return (
                <li
                  key={milestone.convertedCount}
                  className={`rounded-lg border px-3 py-3 text-sm ${
                    reached
                      ? "border-accent/25 bg-accent/[0.05]"
                      : "border-border/60 bg-transparent"
                  }`}
                >
                  <p className="text-foreground/85">{milestone.label}</p>
                  <p className="mt-1 text-xs text-foreground/45">
                    {milestone.convertedCount} converted member
                    {milestone.convertedCount === 1 ? "" : "s"}
                    {reached ? " · reached" : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>

        {summary.rewards.length > 0 ? (
          <div className="border-t border-border pt-5">
            <p className="text-[10px] uppercase tracking-[0.22em] text-foreground/45">
              Care rewards
            </p>
            <ul className="mt-4 space-y-3">
              {summary.rewards.map((reward) => (
                <li
                  key={reward.id}
                  className="flex items-start justify-between gap-3 text-sm"
                >
                  <div>
                    <p className="text-foreground/85">{reward.label}</p>
                    <p className="mt-1 text-xs text-foreground/45">
                      Earned {formatDate(reward.earnedAt)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-accent/90">
                    {REWARD_STATUS_LABEL[reward.status]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {summary.activity.length > 0 ? (
          <ul className="divide-y divide-border border-t border-border">
            {summary.activity.map((item) => (
              <li
                key={item.id}
                className="flex items-baseline justify-between gap-3 py-3"
              >
                <span className="min-w-0 truncate text-sm text-foreground/80">
                  {item.leadName}
                </span>
                <span className="flex shrink-0 items-baseline gap-3">
                  <span className={`text-xs ${STATUS_TONE[item.status]}`}>
                    {STATUS_LABEL[item.status]}
                  </span>
                  <span className="font-mono text-[11px] text-foreground/40">
                    {formatDate(item.convertedAt ?? item.createdAt)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm leading-relaxed text-foreground/50">
            No referrals yet. Your link is ready whenever the subject of home
            care comes up.
          </p>
        )}
      </PortalCard>
    </PortalSection>
  );
}
