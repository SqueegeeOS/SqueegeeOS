"use client";

import Link from "next/link";
import {
  buildSqueegeeKingTierQuotes,
  membershipRequestHref,
  type SqueegeeKingTierQuote,
} from "@/lib/membership/tier-config";

function FeatureMark({ included }: { included: boolean }) {
  return (
    <span
      className={included ? "text-accent" : "text-muted/40"}
      aria-label={included ? "Included" : "Not included"}
    >
      {included ? "✓" : "✗"}
    </span>
  );
}

function TierColumn({
  tier,
  variant,
  squareFootage,
}: {
  tier: SqueegeeKingTierQuote;
  variant: "marketing" | "default";
  squareFootage: number;
}) {
  const isMarketing = variant === "marketing";
  const shell = tier.highlighted
    ? isMarketing
      ? "bg-accent/[0.07] ring-1 ring-inset ring-accent/25"
      : "bg-accent/[0.06] ring-1 ring-inset ring-accent/30"
    : isMarketing
      ? "bg-white/[0.03]"
      : "bg-surface";

  const divider = isMarketing ? "border-white/10" : "border-border/70";
  const muted = isMarketing ? "text-white/50" : "text-muted";
  const text = isMarketing ? "text-[#f5f2eb]" : "text-foreground";

  const rows: Array<{ label: string; value: React.ReactNode }> = [
    { label: "Schedule", value: tier.frequency },
    {
      label: "RainBlock",
      value: <FeatureMark included={tier.rainblockIncluded} />,
    },
    {
      label: "Hard Water",
      value: <FeatureMark included={tier.hardWaterIncluded} />,
    },
    {
      label: "Add-ons",
      value: `${tier.addonDiscount}% off`,
    },
    {
      label: "Price",
      value: (
        <span className="font-serif text-xl font-light tracking-tight sm:text-2xl">
          {tier.periodPriceLabel}
        </span>
      ),
    },
  ];

  return (
    <article className={`flex flex-col rounded-[1.35rem] ${shell}`}>
      <header className={`border-b px-6 py-6 sm:px-8 ${divider}`}>
        {tier.highlighted && (
          <p className="mb-2 text-[10px] uppercase tracking-[0.22em] text-accent">
            Recommended
          </p>
        )}
        <h3 className={`font-serif text-2xl font-light ${text}`}>{tier.label}</h3>
        <p className={`mt-1 text-xs ${muted}`}>{tier.tagline}</p>
      </header>

      <dl className="flex flex-1 flex-col px-6 py-2 sm:px-8">
        {rows.map((row) => (
          <div
            key={row.label}
            className={`flex items-center justify-between gap-4 border-b py-4 last:border-b-0 ${divider}`}
          >
            <dt className={`text-sm ${muted}`}>{row.label}</dt>
            <dd className={`text-right text-sm font-medium ${text}`}>
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className={`border-t px-6 py-6 sm:px-8 ${divider}`}>
        <Link
          href={membershipRequestHref(tier.id, squareFootage)}
          className={`inline-flex min-h-[48px] w-full items-center justify-center rounded-full text-[11px] font-medium uppercase tracking-[0.16em] transition-opacity hover:opacity-90 touch-manipulation ${
            tier.highlighted
              ? "bg-accent text-background"
              : isMarketing
                ? "border border-white/15 bg-white/[0.04] text-[#f5f2eb]"
                : "border border-border bg-background text-foreground"
          }`}
        >
          Start {tier.label}
        </Link>
      </div>
    </article>
  );
}

export interface SqueegeeKingTierComparisonProps {
  squareFootage?: number;
  variant?: "marketing" | "default";
  className?: string;
}

/** Side-by-side Quarterly vs Bi-Annual — sourced from SQUEEGEEKING_TIERS. */
export function SqueegeeKingTierComparison({
  squareFootage = 2500,
  variant = "default",
  className = "",
}: SqueegeeKingTierComparisonProps) {
  const tiers = buildSqueegeeKingTierQuotes(squareFootage);

  return (
    <div
      className={`grid gap-4 sm:gap-5 md:grid-cols-2 md:gap-6 ${className}`}
    >
      {tiers.map((tier) => (
        <TierColumn
          key={tier.id}
          tier={tier}
          variant={variant}
          squareFootage={squareFootage}
        />
      ))}
    </div>
  );
}
