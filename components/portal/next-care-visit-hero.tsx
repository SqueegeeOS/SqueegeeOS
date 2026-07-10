"use client";

import { motion, useReducedMotion } from "framer-motion";
import { AtlasMark } from "@/components/theme/atlas-mark";
import { GlassCard } from "@/components/craft/glass-card";
import type { PortalNextCareVisit } from "@/lib/membership/portal-next-care-visit";
import { materialize } from "@/lib/motion/system";

function CareVisitDateAccent({
  dateShortLabel,
}: {
  dateShortLabel: string | null;
}) {
  const parsed = dateShortLabel?.match(/^(\w+)\s+(\d{1,2})$/);
  const month = parsed?.[1] ?? null;
  const day = parsed?.[2] ?? null;

  return (
    <div
      className="relative flex h-[4.75rem] w-[4.25rem] shrink-0 flex-col items-center justify-center rounded-[1.15rem] border border-accent/25 bg-accent/[0.07] shadow-[inset_0_1px_0_var(--glass-highlight)] sm:h-[5.25rem] sm:w-[4.75rem]"
      aria-hidden
    >
      <AtlasMark size={22} className="mb-1 text-accent/75" />
      {month && day ? (
        <>
          <span className="text-[9px] font-medium uppercase tracking-[0.22em] text-accent/85">
            {month.slice(0, 3)}
          </span>
          <span className="font-serif text-[1.65rem] leading-none text-foreground sm:text-[1.85rem]">
            {day}
          </span>
        </>
      ) : (
        <span className="font-serif text-lg text-foreground/80">—</span>
      )}
    </div>
  );
}

export function NextCareVisitHero({ visit }: { visit: PortalNextCareVisit }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      id="next-care-visit"
      aria-label="Next care visit"
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      variants={materialize}
      transition={{ delay: reduceMotion ? 0 : 0.12 }}
      className="next-care-visit-hero mt-10 w-full sm:mt-12"
    >
      <GlassCard
        rim
        tone="elevated"
        padding="lg"
        className="relative overflow-hidden text-left"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/[0.07] via-transparent to-accent/[0.02]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-accent/[0.05] blur-2xl"
          aria-hidden
        />

        <div className="relative flex gap-4 sm:gap-5">
          {visit.hasScheduledVisit ? (
            <CareVisitDateAccent dateShortLabel={visit.dateShortLabel} />
          ) : (
            <div
              className="flex h-[4.75rem] w-[4.25rem] shrink-0 items-center justify-center rounded-[1.15rem] border border-border bg-[var(--glass-bg-subtle)] sm:h-[5.25rem] sm:w-[4.75rem]"
              aria-hidden
            >
              <AtlasMark size={30} className="text-accent/60" />
            </div>
          )}

          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-[10px] font-medium uppercase tracking-[0.32em] text-accent/90">
              Next Care Visit
            </p>

            {visit.hasScheduledVisit && visit.dateShortLabel ? (
              <>
                <p className="mt-2 font-serif text-[1.75rem] leading-[1.05] tracking-[-0.01em] text-foreground sm:text-[2.125rem]">
                  {visit.dateShortLabel}
                </p>
                <p className="mt-2.5 text-[0.8125rem] leading-snug text-foreground/78 sm:text-sm">
                  {visit.serviceTypeLabel}
                </p>
                {visit.timeWindow ? (
                  <p className="mt-2 inline-flex max-w-full items-center gap-2 text-[0.8125rem] text-muted sm:text-sm">
                    <span
                      className="h-px w-4 shrink-0 bg-accent/35"
                      aria-hidden
                    />
                    <span>{visit.timeWindow}</span>
                  </p>
                ) : null}
                <p className="mt-4 max-w-[22rem] text-[0.8125rem] leading-relaxed text-foreground/52 sm:text-sm">
                  {visit.heroSupportCopy}
                </p>
              </>
            ) : (
              <>
                <p className="mt-3 font-serif text-lg leading-snug text-foreground/88 sm:text-xl">
                  {visit.emptyCopy}
                </p>
                <p className="mt-3 max-w-[20rem] text-[0.8125rem] leading-relaxed text-foreground/48 sm:text-sm">
                  HomeAtlas remembers what&apos;s next for your home.
                </p>
              </>
            )}
          </div>
        </div>

        {visit.hasScheduledVisit ? (
          <p className="relative mt-5 border-t border-border/80 pt-4 text-[0.75rem] leading-relaxed text-foreground/45 sm:text-[0.8125rem]">
            {visit.reassuranceCopy}
          </p>
        ) : null}
      </GlassCard>
    </motion.section>
  );
}
