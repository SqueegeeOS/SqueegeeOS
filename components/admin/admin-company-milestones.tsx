"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { CompanyMilestone } from "@/lib/admin/milestones";

const easeLuxury = [0.22, 1, 0.36, 1] as const;

interface AdminCompanyMilestonesProps {
  milestones: CompanyMilestone[];
}

export function AdminCompanyMilestones({
  milestones,
}: AdminCompanyMilestonesProps) {
  const reduceMotion = useReducedMotion();
  const initialized = useRef(false);
  const previouslyAchieved = useRef<Set<string>>(new Set());
  const [celebratingIds, setCelebratingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const newlyAchieved = new Set<string>();

    for (const milestone of milestones) {
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
  }, [milestones]);

  return (
    <article className="rounded-[1.75rem] border border-border/80 bg-surface/55 p-6 sm:p-7">
      <p className="text-[10px] uppercase tracking-[0.28em] text-muted">
        Company Milestones
      </p>
      <ul className="mt-5 space-y-3">
        {milestones.map((milestone, index) => {
          const isCelebrating =
            milestone.achieved && celebratingIds.has(milestone.id);

          return (
            <motion.li
              key={milestone.id}
              initial={reduceMotion ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.5,
                delay: reduceMotion ? 0 : index * 0.04,
                ease: easeLuxury,
              }}
              className="flex items-center gap-3"
            >
              <motion.span
                initial={false}
                animate={
                  isCelebrating && !reduceMotion
                    ? {
                        scale: [1, 1.22, 1],
                        boxShadow: [
                          "0 0 0 rgba(201,184,150,0)",
                          "0 0 22px rgba(201,184,150,0.4)",
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
                {milestone.achieved ? "✓" : "□"}
              </motion.span>
              <span
                className={`text-sm leading-snug transition-colors duration-500 ${
                  milestone.achieved ? "text-foreground" : "text-muted/75"
                }`}
              >
                {milestone.label}
              </span>
            </motion.li>
          );
        })}
      </ul>
    </article>
  );
}
