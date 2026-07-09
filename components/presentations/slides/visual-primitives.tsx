"use client";

import type { ReactNode } from "react";
import {
  presentationDifferenceRows,
  presentationIncludedItems,
} from "@/lib/presentations/tier-benefits";
import type { SqueegeeKingTierId } from "@/lib/membership/tier-config";
import { normalizeToSqueegeeKingTier } from "@/lib/membership/tier-config";

export function VisualIcon({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-accent ${className}`}
      aria-hidden
    >
      {children}
    </span>
  );
}

export function TrustPills({ items }: { items: string[] }) {
  return (
    <div className="mt-10 flex flex-wrap justify-center gap-3">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-[11px] tracking-wide text-white/55"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

export function HouseIllustration() {
  return (
    <svg
      viewBox="0 0 120 120"
      className="mx-auto h-28 w-28 text-accent/60 sm:h-32 sm:w-32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      aria-hidden
    >
      <path d="M20 95 L60 25 L100 95 Z" />
      <rect x="48" y="58" width="24" height="28" rx="1" />
      <path d="M35 95 L85 95" />
    </svg>
  );
}

export function IncludedVisual({ tier }: { tier: SqueegeeKingTierId | string }) {
  const items = presentationIncludedItems(tier);

  return (
    <div className="mt-10">
      <div className="mx-auto flex max-w-xs items-center justify-center rounded-3xl border border-accent/15 bg-gradient-to-b from-accent/[0.06] to-transparent py-10 sm:max-w-sm">
        <HouseIllustration />
      </div>
      <div className="mx-auto mt-8 grid max-w-2xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-left"
          >
            <span className="mt-0.5 text-accent" aria-hidden>◇</span>
            <div>
              <p className="text-sm text-[#f5f2eb]/90">{item.label}</p>
              <p className="mt-0.5 text-[11px] text-white/45">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DifferenceVisual({ tier }: { tier: SqueegeeKingTierId | string }) {
  const rows = presentationDifferenceRows(tier);
  const normalized = normalizeToSqueegeeKingTier(tier);

  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-accent/30 bg-accent/[0.06] p-5 sm:p-6">
        <p className="text-[10px] uppercase tracking-[0.18em] text-accent">SqueegeeKing</p>
        <ul className="mt-4 space-y-3.5">
          {rows.map((row) => (
            <li key={row.us} className="flex items-start gap-3 text-sm leading-snug text-[#f5f2eb]">
              <span className="mt-0.5 text-accent">✓</span>
              <span>{row.us}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Typical service</p>
        <ul className="mt-4 space-y-3.5">
          {rows.map((row) => (
            <li key={row.them} className="flex items-start gap-3 text-sm leading-snug text-white/50">
              <span className="mt-0.5 text-white/30" aria-hidden>✕</span>
              <span>{row.them}</span>
            </li>
          ))}
        </ul>
      </div>
      {normalized === "biannual" ? (
        <p className="sm:col-span-2 text-center text-[11px] text-white/40">
          RainBlock and Hard Water are available as add-on services with Bi-Annual membership.
        </p>
      ) : null}
    </div>
  );
}

function StepIcon({ type }: { type: "calendar" | "truck" | "home" | "sparkle" }) {
  const paths = {
    calendar: (
      <>
        <rect x="6" y="8" width="20" height="18" rx="2" />
        <path d="M6 12h20M10 6v4M22 6v4" />
      </>
    ),
    truck: (
      <>
        <path d="M4 14h12v6H4zM16 14l4 4v6h-4" />
        <circle cx="8" cy="22" r="2" />
        <circle cx="18" cy="22" r="2" />
      </>
    ),
    home: (
      <>
        <path d="M12 5 L4 13 h3 v8 h10 v-8 h3 z" />
      </>
    ),
    sparkle: (
      <>
        <path d="M12 4v4M12 20v4M4 12h4M20 12h4M6.3 6.3l2.8 2.8M16.9 16.9l2.8 2.8M17.7 6.3l-2.8 2.8M6.3 17.7l2.8-2.8" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
      {paths[type]}
    </svg>
  );
}

const PROCESS_STEPS = [
  { icon: "calendar" as const, title: "On the schedule", detail: "Your visits are planned" },
  { icon: "truck" as const, title: "We arrive", detail: "On time, every time" },
  { icon: "home" as const, title: "We care", detail: "Your home, our focus" },
  { icon: "sparkle" as const, title: "You enjoy", detail: "Nothing left to do" },
] as const;

export function ProcessTimeline() {
  return (
    <div className="mt-10 grid gap-6 sm:grid-cols-4 sm:gap-4">
      {PROCESS_STEPS.map((step, index) => (
        <div key={step.title} className="relative text-center">
          {index < PROCESS_STEPS.length - 1 ? (
            <div
              className="absolute left-[calc(50%+1.75rem)] top-5 hidden h-px w-[calc(100%-3.5rem)] bg-gradient-to-r from-white/15 to-white/5 sm:block"
              aria-hidden
            />
          ) : null}
          <VisualIcon className="mx-auto h-10 w-10">
            <StepIcon type={step.icon} />
          </VisualIcon>
          <p className="mt-3 text-sm font-medium text-[#f5f2eb]">{step.title}</p>
          <p className="mt-1 text-xs text-white/50">{step.detail}</p>
        </div>
      ))}
    </div>
  );
}

export function IconBullet({
  icon,
  children,
}: {
  icon: string;
  children: ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 text-left text-sm text-white/65">
      <VisualIcon className="h-8 w-8 text-xs font-medium">{icon}</VisualIcon>
      <span className="pt-1.5 leading-relaxed">{children}</span>
    </li>
  );
}

export function ExpandLink({
  open,
  onClick,
}: {
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className="rounded text-xs text-accent/80 underline-offset-4 transition-colors duration-200 hover:text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent/60"
    >
      {open ? "Hide details" : "View details"}
    </button>
  );
}
