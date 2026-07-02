"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { MemberPrivilege } from "@/lib/membership/member-privileges";

const easeLuxury = [0.22, 1, 0.36, 1] as const;

function PrivilegeIcon({ id }: { id: string }) {
  const stroke = "currentColor";
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke,
    strokeWidth: 1.2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-5 w-5",
    "aria-hidden": true,
  };

  switch (id) {
    case "vip-scheduling":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M3 11h18" />
          <path d="M12 14v3" />
        </svg>
      );
    case "rain-guarantee":
      return (
        <svg {...common}>
          <path d="M8 16c0-3 2-5 4-5s4 2 4 5" />
          <path d="M6 18h12" />
          <path d="M9 12V9a3 3 0 116 0v3" />
        </svg>
      );
    case "hard-water":
      return (
        <svg {...common}>
          <path d="M12 3c3 4 6 7 6 11a6 6 0 11-12 0c0-4 3-7 6-11z" />
        </svg>
      );
  }

  return (
    <svg {...common}>
      <path d="M12 2l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6z" />
    </svg>
  );
}

interface MemberPrivilegeCardProps {
  privilege: MemberPrivilege;
  index: number;
  animate?: boolean;
  fromUnlock?: boolean;
}

export function MemberPrivilegeCard({
  privilege,
  index,
  animate = true,
  fromUnlock = false,
}: MemberPrivilegeCardProps) {
  const reduceMotion = useReducedMotion();
  const baseDelay = fromUnlock ? 1.35 : 0.15;

  return (
    <motion.article
      initial={animate && !reduceMotion ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduceMotion ? 0.15 : 1.05,
        delay: reduceMotion ? 0 : baseDelay + 0.16 * index,
        ease: easeLuxury,
      }}
      className={`rounded-2xl border p-6 sm:p-7 ${
        privilege.featured
          ? "border-accent/25 bg-gradient-to-br from-accent/[0.06] to-surface"
          : "border-border bg-surface"
      }`}
      style={{
        boxShadow: privilege.featured
          ? "0 6px 28px rgba(0,0,0,0.18)"
          : "0 3px 16px rgba(0,0,0,0.08)",
      }}
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
            privilege.featured
              ? "border-accent/25 bg-accent/10 text-accent"
              : "border-border bg-surface-elevated text-muted"
          }`}
        >
          <PrivilegeIcon id={privilege.id} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.26em] text-accent">
            {privilege.tagline}
          </p>
          <h3 className="mt-2 font-serif text-xl font-light text-foreground sm:text-2xl">
            {privilege.title}
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {privilege.description}
          </p>
          {privilege.detail && (
            <p className="mt-3 text-xs leading-relaxed text-muted/80">
              {privilege.detail}
            </p>
          )}
        </div>
      </div>
    </motion.article>
  );
}
