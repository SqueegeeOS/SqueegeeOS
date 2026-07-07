"use client";

import type { ReactNode } from "react";
import {
  tierLabel,
  tierTagline,
  type PresentationData,
  type SlideOverride,
} from "@/lib/presentations/types";
import {
  computePresentationRates,
  visitRateFromPresentation,
} from "@/lib/presentations/calculations";
import {
  SQUEEGEEKING_TIERS,
  TIER_COMPARISON_ROWS,
  formatTierPrice,
  normalizeToSqueegeeKingTier,
  type SqueegeeKingTierId,
} from "@/lib/membership/tier-config";

export function FullSlide({
  children,
  background = "#060606",
  className = "",
}: {
  children: ReactNode;
  background?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex h-full min-h-[calc(100vh-60px)] items-center justify-center px-6 py-12 sm:px-12 ${className}`}
      style={{ background }}
    >
      <div className="w-full max-w-5xl">{children}</div>
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 text-[11px] uppercase tracking-[0.2em] text-accent/70">
      {children}
    </p>
  );
}

export function HeroText({ children }: { children: ReactNode }) {
  return (
    <h1 className="font-serif text-4xl font-light leading-tight text-[#f5f2eb] sm:text-6xl">
      {children}
    </h1>
  );
}

export function SubText({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 text-base leading-relaxed text-white/50 sm:text-lg">
      {children}
    </p>
  );
}

export function TierBadge({ tier }: { tier: PresentationData["tier"] | string }) {
  const sk = normalizeToSqueegeeKingTier(tier);
  const def = SQUEEGEEKING_TIERS[sk];
  return (
    <span className="mt-6 inline-flex flex-col items-center gap-1">
      <span className="inline-flex rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-[11px] uppercase tracking-[0.16em] text-accent">
        {def.label} · {def.tagline}
      </span>
      {def.premiumBadge && (
        <span className="text-[10px] uppercase tracking-[0.14em] text-accent/70">
          {def.premiumBadge}
        </span>
      )}
    </span>
  );
}

export function BigNumber({
  prefix = "",
  value,
  suffix = "",
}: {
  prefix?: string;
  value: number;
  suffix?: string;
}) {
  return (
    <p className="font-serif text-5xl font-light text-[#f5f2eb] sm:text-6xl">
      {prefix}
      {value.toLocaleString("en-US")}
      <span className="text-2xl text-white/50">{suffix}</span>
    </p>
  );
}

export function TwoColumn({
  left,
  right,
}: {
  left: ReactNode;
  right: ReactNode;
}) {
  return (
    <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
      <div>{left}</div>
      <div>{right}</div>
    </div>
  );
}

export function PricingColumn({
  tier,
  visitPrice,
  highlighted = false,
}: {
  tier: SqueegeeKingTierId;
  visitPrice: number;
  highlighted?: boolean;
}) {
  const def = SQUEEGEEKING_TIERS[tier];
  return (
    <div
      className={`rounded-lg border p-6 ${
        highlighted
          ? "border-accent/40 bg-accent/[0.08] shadow-[0_0_40px_rgba(197,168,105,0.12)]"
          : "border-white/10 bg-white/[0.03]"
      }`}
    >
      {highlighted && (
        <p className="mb-3 text-[10px] uppercase tracking-[0.16em] text-accent">
          Most Popular
        </p>
      )}
      <p className="text-sm text-white/50">{def.tagline}</p>
      <p className="mt-1 font-serif text-2xl text-[#f5f2eb]">{def.label}</p>
      <p className="mt-4 font-serif text-4xl text-[#f5f2eb]">
        {formatTierPrice(visitPrice)}
        <span className="text-lg text-white/40">/visit</span>
      </p>
      <p className="mt-2 text-xs text-white/40">
        {def.visitsPerYear} visits · {def.frequency}
      </p>
      <p
        className={`mt-3 text-sm font-medium ${
          highlighted ? "text-accent" : "text-white/70"
        }`}
      >
        {def.addonDiscount}% OFF all add-ons
      </p>
      {!highlighted && (
        <p className="mt-2 text-[11px] text-white/35">
          Upgrade to Quarterly for RainBlock + Hard Water + 25% OFF
        </p>
      )}
    </div>
  );
}

export function TierComparisonTable() {
  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-white/10">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.03]">
            <th className="px-4 py-3 font-normal text-white/40">Benefit</th>
            <th className="px-4 py-3 text-center font-normal text-white/60">
              Bi-Annual
            </th>
            <th className="px-4 py-3 text-center font-normal text-accent">
              Quarterly
            </th>
          </tr>
        </thead>
        <tbody>
          {TIER_COMPARISON_ROWS.map((row) => (
            <tr key={row.label} className="border-b border-white/5">
              <td className="px-4 py-2.5 text-white/70">{row.label}</td>
              <td className="px-4 py-2.5 text-center text-white/50">
                {row.biannual}
              </td>
              <td className="px-4 py-2.5 text-center text-accent/90">
                {row.quarterly}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BreakdownCard({ presentation }: { presentation: PresentationData }) {
  const rates = computePresentationRates(presentation);
  const selected = normalizeToSqueegeeKingTier(presentation.tier);
  const visit = visitRateFromPresentation(presentation);

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-6">
      <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">
        Selected: {tierLabel(selected)}
      </p>
      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-white/40">Per visit</dt>
          <dd>{formatTierPrice(visit)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-white/40">Annual total</dt>
          <dd>{formatTierPrice(rates.annualRate)}</dd>
        </div>
        {selected === "quarterly" && (
          <div className="flex justify-between gap-4">
            <dt className="text-white/40">Added treatment value</dt>
            <dd>{formatTierPrice(rates.retailValue)}/yr at retail</dd>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <dt className="text-white/40">Add-on discount</dt>
          <dd>{SQUEEGEEKING_TIERS[selected].addonDiscount}% OFF</dd>
        </div>
      </dl>
    </div>
  );
}

export function ScheduleList({ presentation }: { presentation: PresentationData }) {
  const tier = normalizeToSqueegeeKingTier(presentation.tier);
  const def = SQUEEGEEKING_TIERS[tier];
  const months =
    tier === "quarterly" ? [0, 3, 6, 9] : [2, 8];

  return (
    <ul className="mt-6 space-y-2">
      {months.map((month, index) => (
        <li
          key={month}
          className="flex items-center justify-between rounded border border-white/10 bg-white/[0.03] px-4 py-3 text-sm"
        >
          <span>
            {new Date(2026, month, 15).toLocaleDateString("en-US", {
              month: "long",
            })}{" "}
            — Exterior windows
          </span>
          <span className="text-[10px] uppercase tracking-[0.14em] text-white/40">
            Visit {index + 1} of {def.visitsPerYear}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ServicesList({ presentation }: { presentation: PresentationData }) {
  const tier = normalizeToSqueegeeKingTier(presentation.tier);
  const benefits = SQUEEGEEKING_TIERS[tier].benefits;
  return (
    <ul className="mt-6 grid gap-2 sm:grid-cols-2">
      {benefits.map((benefit) => (
        <li
          key={benefit}
          className="rounded border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/80"
        >
          {benefit}
        </li>
      ))}
    </ul>
  );
}

export type { PresentationData, SlideOverride };
