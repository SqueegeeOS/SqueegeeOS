"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { AtlasMark } from "@/components/theme/atlas-mark";
import { GlassCard } from "@/components/craft/glass-card";
import type { PortalLiveServiceStatus } from "@/lib/membership/portal-live-service";
import { materialize } from "@/lib/motion/system";

const TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  hour: "numeric",
  minute: "2-digit",
});

const AUTO_REFRESH_MS = 60_000;

function LiveProgress({
  completed,
  total,
}: PortalLiveServiceStatus["progress"]) {
  return (
    <div
      className="grid grid-cols-5 gap-1.5"
      role="progressbar"
      aria-label="Today's visit progress"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={completed}
    >
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={`h-1.5 rounded-full ${
            index < completed ? "bg-accent" : "bg-foreground/10"
          }`}
          aria-hidden
        />
      ))}
    </div>
  );
}

export function LiveCareStatus({
  status,
}: {
  status: PortalLiveServiceStatus;
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const shouldRefresh = status.stage !== "departed";

  useEffect(() => {
    if (!shouldRefresh) return;
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const interval = window.setInterval(refreshWhenVisible, AUTO_REFRESH_MS);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [router, shouldRefresh]);

  return (
    <motion.section
      aria-label="Live care visit status"
      aria-live="polite"
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      variants={materialize}
      transition={{ delay: reduceMotion ? 0 : 0.08 }}
      className="mt-10 w-full sm:mt-12"
    >
      <GlassCard
        rim
        tone="elevated"
        padding="lg"
        className="relative overflow-hidden text-left"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/[0.14] via-accent/[0.025] to-transparent"
          aria-hidden
        />
        <div className="relative">
          <div className="flex items-start gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10 shadow-[inset_0_1px_0_var(--glass-highlight)]"
              aria-hidden
            >
              <AtlasMark size={26} className="text-accent" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-accent">
                  Live care visit
                </p>
                <p className="text-[10px] uppercase tracking-[0.16em] text-foreground/45">
                  Updated {TIME_FORMATTER.format(new Date(status.updatedAt))}
                </p>
              </div>
              <p className="mt-3 font-serif text-[1.55rem] leading-tight text-foreground sm:text-[1.85rem]">
                {status.headline}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground/60">
                {status.support}
              </p>
            </div>
          </div>

          <div className="mt-5 border-t border-border/70 pt-4">
            <div className="mb-2.5 flex items-center justify-between gap-4 text-xs">
              <span className="font-medium text-foreground/85">
                {status.statusLabel}
              </span>
              <span className="text-foreground/45">
                {status.serviceTypeLabel}
              </span>
            </div>
            <LiveProgress {...status.progress} />
          </div>
        </div>
      </GlassCard>
    </motion.section>
  );
}
