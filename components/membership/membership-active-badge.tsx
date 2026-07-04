"use client";

import { useReducedMotion } from "framer-motion";

type MembershipActiveBadgeVariant = "hero" | "nav" | "navLight" | "inline";

const VARIANT: Record<
  MembershipActiveBadgeVariant,
  { shell: string; text: string; dot: string; ring: string }
> = {
  hero: {
    shell:
      "border-white/15 bg-white/[0.06] backdrop-blur-sm shadow-[0_0_24px_rgba(52,211,153,0.08)]",
    text: "text-emerald-200/90",
    dot: "bg-emerald-300",
    ring: "bg-emerald-300/45",
  },
  nav: {
    shell: "border-emerald-400/20 bg-emerald-400/[0.06]",
    text: "text-emerald-300/90",
    dot: "bg-emerald-400",
    ring: "bg-emerald-400/40",
  },
  navLight: {
    shell: "border-emerald-500/25 bg-emerald-500/[0.07]",
    text: "text-emerald-600/90",
    dot: "bg-emerald-500",
    ring: "bg-emerald-500/35",
  },
  inline: {
    shell: "border-emerald-400/15 bg-emerald-400/[0.05]",
    text: "text-emerald-400/90",
    dot: "bg-emerald-400",
    ring: "bg-emerald-400/35",
  },
};

function ActivePulseDot({
  dotClass,
  ringClass,
  reduceMotion,
}: {
  dotClass: string;
  ringClass: string;
  reduceMotion: boolean | null;
}) {
  return (
    <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden>
      {!reduceMotion && (
        <span
          className={`absolute inset-0 rounded-full ${ringClass} motion-active-pulse-ring`}
        />
      )}
      <span className={`relative h-1.5 w-1.5 rounded-full ${dotClass}`} />
    </span>
  );
}

/** Membership live indicator — calm green pulse, luxury typography. */
export function MembershipActiveBadge({
  variant = "inline",
  className = "",
}: {
  variant?: MembershipActiveBadgeVariant;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const styles = VARIANT[variant];

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 ${styles.shell} ${className}`}
    >
      <ActivePulseDot
        dotClass={styles.dot}
        ringClass={styles.ring}
        reduceMotion={reduceMotion}
      />
      <span
        className={`text-[9px] font-medium uppercase tracking-[0.24em] ${styles.text}`}
      >
        Active
      </span>
    </span>
  );
}
