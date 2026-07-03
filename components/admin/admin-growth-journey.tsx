"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { GrowthJourneyTier } from "@/lib/admin/growth-journey";

const easeLuxury = [0.22, 1, 0.36, 1] as const;

interface AdminGrowthJourneyProps {
  tiers: GrowthJourneyTier[];
}

export function AdminGrowthJourney({ tiers }: AdminGrowthJourneyProps) {
  const reduceMotion = useReducedMotion();
  const initialized = useRef(false);
  const previouslyAchieved = useRef<Set<string>>(new Set());
  const [celebratingIds, setCelebratingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const newlyAchieved = new Set<string>();
    const allMilestones = tiers.flatMap((tier) => tier.milestones);

    for (const milestone of allMilestones) {
      if (!milestone.achieved) continue;

      if (!initialized.current) {
        previouslyAchieved.current.add(milestone.id);
        continue;
      }

      if (!previouslyAchieved.current.has(milestone.id)) {
        previouslyAchieved.current.add(milestone.id);
        newlyAchieved.add(milestone.id);
      }
    }

    initialized.current = true;

    if (newlyAchieved.size === 0) return;

    setCelebratingIds(newlyAchieved);
    const timer = window.setTimeout(() => setCelebratingIds(new Set()), 900);
    return () => window.clearTimeout(timer);
  }, [tiers]);

  return (
    <article className="rounded-[1.75rem] border border-border/80 bg-surface/55 p-6 sm:p-7">
      <p className="text-[10px] uppercase tracking-[0.28em] text-muted">
        Growth Journey
      </p>
      <div className="mt-6 space-y-7">
        {tiers.map((tier, tierIndex) => {
          const achievedCount = tier.milestones.filter((m) => m.achieved).length;

          return (
            <section key={tier.id}>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h3 className="font-serif text-lg font-light text-foreground">
                  {tier.label}
                </h3>
                <span className="text-[10px] uppercase tracking-[0.18em] text-muted/70">
                  {achievedCount}/{tier.milestones.length}
                </span>
              </div>
              <ul className="space-y-2.5">
                {tier.milestones.map((milestone, index) => {
                  const isCelebrating =
                    milestone.achieved && celebratingIds.has(milestone.id);

                  return (
                    <motion.li
                      key={milestone.id}
                      initial={reduceMotion ? false : { opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        duration: 0.45,
                        delay: reduceMotion ? 0 : tierIndex * 0.05 + index * 0.03,
                        ease: easeLuxury,
                      }}
                      className="flex items-center gap-3"
                    >
                      <motion.span
                        initial={false}
                        animate={
                          isCelebrating && !reduceMotion
                            ? {
                                scale: [1, 1.2, 1],
                                boxShadow: [
                                  "0 0 0 rgba(201,184,150,0)",
                                  "0 0 20px rgba(201,184,150,0.38)",
                                  "0 0 0 rgba(201,184,150,0)",
                                ],
                              }
                            : { scale: 1 }
                        }
                        transition={{ duration: 0.75, ease: easeLuxury }}
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border text-[11px] font-medium leading-none ${
                          milestone.achieved
                            ? "border-accent/50 bg-accent/15 text-accent"
                            : "border-border/70 bg-background/20 text-transparent"
                        }`}
                        aria-hidden
                      >
                        {milestone.achieved ? "✓" : ""}
                      </motion.span>
                      <span
                        className={`text-sm leading-snug ${
                          milestone.achieved ? "text-foreground" : "text-muted/75"
                        }`}
                      >
                        {milestone.label}
                        {milestone.achieved && milestone.achievedByLegacy && (
                          <span className="ml-2 text-[9px] uppercase tracking-[0.14em] text-muted/70">
                            · Legacy
                          </span>
                        )}
                      </span>
                    </motion.li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </article>
  );
}
