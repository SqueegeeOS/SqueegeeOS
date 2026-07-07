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
      <div className="space-y-1">
        <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-amber-200/90">
          <span className="font-serif normal-case tracking-normal text-amber-300/95">
            ✦{" "}
          </span>
          {display.title}
        </p>
        <p className="text-[10px] leading-snug text-white/55">{display.story}</p>
        <p className="text-[9px] uppercase tracking-[0.16em] text-amber-100/75">
          {display.memberSinceLine}
        </p>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-amber-100/95">
        <span
          className="font-serif normal-case tracking-normal text-amber-300/95"
          aria-hidden
        >
          ✦
        </span>
        {display.title}
      </span>
    );
  }

  return (
    <div className="mt-5 max-w-lg rounded-2xl border border-amber-400/20 bg-amber-500/[0.07] px-5 py-4 backdrop-blur-sm">
      <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-amber-200/95">
        <span className="font-serif text-sm normal-case tracking-normal text-amber-300">
          ✦{" "}
        </span>
        {display.title}
      </p>
      <p className="mt-3 font-serif text-base font-light leading-relaxed text-white/90 sm:text-lg">
        {display.story}
      </p>
      <p className="mt-3 text-[10px] uppercase tracking-[0.22em] text-amber-100/80">
        {display.memberSinceLine}
      </p>
    </div>
  );
}
