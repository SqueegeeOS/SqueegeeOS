"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ClaimCeremony } from "@/components/portal/claim-ceremony";
import { PortalCard, PortalSection } from "@/components/portal/portal-section";
import {
  dollarLabel,
  firstClaimableReward,
  preClaimCopy,
  settledRewardStatusLine,
} from "@/lib/referrals/ceremony-copy";
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
  earned: "Unlocked",
  available: "Claimed",
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
  firstName,
  index,
}: {
  portalToken: string;
  firstName: string;
  index: number;
}) {
  const [summary, setSummary] = useState<MemberReferralSummary | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [ceremony, setCeremony] = useState<{ rewardLabel: string } | null>(null);
  /** One idempotency key per reward: retries converge on one claim event. */
  const idempotencyKeys = useRef(new Map<string, string>());

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

  const claimReward = useCallback(
    async (rewardId: string) => {
      if (claiming) return;
      setClaiming(true);
      setClaimError(null);

      let key = idempotencyKeys.current.get(rewardId);
      if (!key) {
        key = crypto.randomUUID();
        idempotencyKeys.current.set(rewardId, key);
      }

      try {
        const response = await fetch("/api/referrals/portal/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ portalToken, rewardId, idempotencyKey: key }),
        });
        const data = (await response.json().catch(() => null)) as {
          outcome?: string;
          reward?: { id?: string; label?: string; valueCents?: number };
          availableCareCreditCents?: number;
        } | null;

        if (!response.ok || !data?.outcome) {
          setClaimError(
            "We couldn't claim your reward just now. It stays saved for you — please try again shortly.",
          );
          return;
        }

        const availableCents =
          typeof data.availableCareCreditCents === "number"
            ? data.availableCareCreditCents
            : 0;
        setSummary((current) =>
          current
            ? {
                ...current,
                rewards: current.rewards.map((reward) =>
                  reward.id === rewardId
                    ? { ...reward, status: "available" as const }
                    : reward,
                ),
                availableCareCreditLabel:
                  availableCents > 0
                    ? `${dollarLabel(availableCents)} in HomeAtlas Care Credits available`
                    : current.availableCareCreditLabel,
              }
            : current,
        );

        // The ceremony plays ONLY on a fresh claim — an idempotent retry or
        // refresh lands on already_claimed and stays quiet.
        if (data.outcome === "claimed" && data.reward?.label) {
          setCeremony({ rewardLabel: data.reward.label });
        }
      } catch {
        setClaimError(
          "We couldn't claim your reward just now. It stays saved for you — please try again shortly.",
        );
      } finally {
        setClaiming(false);
      }
    },
    [claiming, portalToken],
  );

  if (!loaded || !summary) return null;

  const claimable = firstClaimableReward(summary.rewards);
  const invitation = claimable ? preClaimCopy(claimable) : null;

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

        {claimable && invitation ? (
          <div className="rounded-xl border border-accent/30 bg-accent/[0.07] px-5 py-5">
            <p className="text-[10px] uppercase tracking-[0.22em] text-accent/80">
              {invitation.eyebrow}
            </p>
            <p className="mt-2 font-serif text-xl font-light text-foreground">
              {invitation.headline}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-foreground/60">
              {invitation.support}
            </p>
            <button
              type="button"
              onClick={() => void claimReward(claimable.id)}
              disabled={claiming}
              className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-full bg-accent px-6 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--on-accent)] transition-opacity hover:opacity-90 disabled:opacity-60 touch-manipulation"
            >
              {claiming ? "Claiming…" : invitation.button}
            </button>
            {claimError ? (
              <p className="mt-3 text-xs leading-relaxed text-foreground/55" role="status">
                {claimError}
              </p>
            ) : null}
          </div>
        ) : null}

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
                      {reward.status === "available"
                        ? settledRewardStatusLine()
                        : `Earned ${formatDate(reward.earnedAt)}`}
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

      <ClaimCeremony
        open={ceremony !== null}
        firstName={firstName}
        rewardLabel={ceremony?.rewardLabel ?? ""}
        onSettled={() => setCeremony(null)}
      />
    </PortalSection>
  );
}
