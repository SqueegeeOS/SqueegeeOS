"use client";

import { formatTierPrice } from "@/lib/membership/tier-config";

export interface HomeAtlasJourneyProps {
  memberSince: string;
  membershipTier: string;
  completedVisits: number;
  membershipSavings: number | null;
}

interface JourneyEntry {
  label: string;
  value: string;
}

function JourneyLedger({ entries }: { entries: JourneyEntry[] }) {
  return (
    <div className="border-y border-white/[0.06] py-12 sm:py-14 portal-journey-ledger">
      <dl className="space-y-12 sm:space-y-14">
        {entries.map((entry) => (
          <div key={entry.label}>
            <dt className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/35 portal-journey-label">
              {entry.label}
            </dt>
            <dd className="mt-3 font-serif text-[1.625rem] font-light leading-snug tracking-[-0.01em] text-white/[0.88] sm:text-3xl portal-journey-value">
              {entry.value}
            </dd>
          </div>
        ))}
      </dl>
      {/* Reserved for annual reviews, anniversaries, milestones, and property memories */}
      <div className="mt-14 h-px bg-gradient-to-r from-transparent via-white/[0.05] to-transparent portal-journey-divider" />
    </div>
  );
}

/**
 * Quiet editorial record of the member relationship — not a rewards dashboard.
 */
export function HomeAtlasJourneySection({
  memberSince,
  membershipTier,
  completedVisits,
  membershipSavings,
}: HomeAtlasJourneyProps) {
  const entries: JourneyEntry[] = [
    { label: "Member Since", value: memberSince },
    { label: "Membership Tier", value: membershipTier },
    {
      label: "Completed Visits",
      value: String(completedVisits),
    },
    {
      label: "Membership Savings",
      value:
        membershipSavings != null ? formatTierPrice(membershipSavings) : "—",
    },
  ];

  return (
    <section
      id="homeatlas-journey"
      className="scroll-mt-6"
      aria-labelledby="homeatlas-journey-heading"
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-accent/55 portal-journey-eyebrow">
        Your record
      </p>
      <h2
        id="homeatlas-journey-heading"
        className="mt-4 font-serif text-[1.75rem] font-light leading-[1.12] tracking-[-0.02em] text-white/[0.92] sm:text-4xl portal-journey-heading"
      >
        Your HomeAtlas Journey
      </h2>
      <p className="mt-5 max-w-md text-sm leading-[1.7] text-white/45 portal-journey-copy">
        A quiet record of care — written as your home&apos;s story unfolds.
      </p>
      <div className="mt-10 sm:mt-12">
        <JourneyLedger entries={entries} />
      </div>
    </section>
  );
}
