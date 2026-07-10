"use client";

import { useCallback, useEffect, useState } from "react";
import { PortalCard, PortalSection } from "@/components/portal/portal-section";
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
 * Referral program — the member's shareable link plus live activity.
 * Renders nothing until the summary loads; hides itself entirely when
 * cloud persistence is unavailable (no fake numbers, ever).
 */
export function ReferralSection({
  membershipId,
  memberName,
  index,
}: {
  membershipId: string;
  memberName: string;
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
      body: JSON.stringify({ membershipId, memberName }),
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
  }, [membershipId, memberName]);

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
      eyebrow="Referrals"
      headline="Good care travels."
      support="Share your link. When a neighbor joins, your next reward is on us."
    >
      <PortalCard className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="min-w-0 flex-1 truncate rounded-full border border-border bg-foreground/[0.03] px-4 py-3 font-mono text-sm text-foreground/85">
            {summary.link}
          </p>
          <button
            type="button"
            onClick={copyLink}
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full bg-accent px-6 text-[11px] font-medium uppercase tracking-[0.18em] text-background transition-opacity hover:opacity-90 touch-manipulation"
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>

        <dl className="grid grid-cols-3 gap-3 border-t border-border pt-5 text-center">
          {[
            ["Visits", summary.visitCount],
            ["Requests", summary.referralCount],
            ["Members", summary.convertedCount],
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

        {summary.rewardEligibleCount > 0 && (
          <p className="rounded-xl border border-accent/25 bg-accent/[0.07] px-4 py-3 text-sm leading-relaxed text-accent">
            {summary.rewardEligibleCount === 1
              ? "One referral has joined. A reward is waiting on your next visit."
              : `${summary.rewardEligibleCount} referrals have joined. Rewards are waiting on your next visit.`}
          </p>
        )}

        {summary.activity.length > 0 && (
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
        )}

        {summary.activity.length === 0 && (
          <p className="text-sm leading-relaxed text-foreground/50">
            No referrals yet. Your link is ready whenever the subject of
            clean windows comes up.
          </p>
        )}
      </PortalCard>
    </PortalSection>
  );
}
