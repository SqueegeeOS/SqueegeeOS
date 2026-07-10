"use client";

import type { FoundingMemberDisplay } from "@/lib/membership/founding-member";

interface FoundingMemberHonorProps {
  display: FoundingMemberDisplay;
  variant?: "hero" | "card" | "compact";
}

export function FoundingMemberHonor({
  display,
  variant = "hero",
}: FoundingMemberHonorProps) {
  if (variant === "card") {
    return (
      <div className="founding-honor-card space-y-1">
        <p className="founding-honor-card-title text-[11px] font-medium uppercase tracking-[0.15em] text-amber-200/90">
          <span className="font-serif normal-case tracking-normal text-amber-300/95">
            ✦{" "}
          </span>
          {display.title}
        </p>
        <p className="founding-honor-card-story text-xs leading-[1.3] text-white/55">
          {display.story}
        </p>
        <p className="founding-honor-card-since text-[10px] uppercase tracking-[0.11em] text-amber-100/75">
          {display.memberSinceLine}
        </p>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <span className="founding-honor-compact inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-amber-100/95">
        <span
          className="founding-honor-compact-mark font-serif normal-case tracking-normal text-amber-300/95"
          aria-hidden
        >
          ✦
        </span>
        {display.title}
      </span>
    );
  }

  return (
    <div className="founding-honor-hero mt-5 max-w-lg rounded-2xl border border-amber-400/20 bg-amber-500/[0.07] px-5 py-4 backdrop-blur-sm">
      <p className="founding-honor-hero-title text-[10px] font-medium uppercase tracking-[0.28em] text-amber-200/95">
        <span className="founding-honor-hero-mark font-serif text-sm normal-case tracking-normal text-amber-300">
          ✦{" "}
        </span>
        {display.title}
      </p>
      <p className="founding-honor-hero-story mt-3 font-serif text-base font-light leading-relaxed text-white/90 sm:text-lg">
        {display.story}
      </p>
      <p className="founding-honor-hero-since mt-3 text-[10px] uppercase tracking-[0.22em] text-amber-100/80">
        {display.memberSinceLine}
      </p>
    </div>
  );
}
