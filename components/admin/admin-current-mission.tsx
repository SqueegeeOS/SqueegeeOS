"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { CurrentMission } from "@/lib/admin/current-mission";
import { riseSubtle } from "@/lib/motion/system";
import { useBootLayerDelay } from "@/components/motion/boot-provider";

interface AdminCurrentMissionProps {
  missions: CurrentMission[];
}

export function AdminCurrentMission({ missions }: AdminCurrentMissionProps) {
  const reduceMotion = useReducedMotion();
  const delay = useBootLayerDelay("missions");

  return (
    <motion.article
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      variants={riseSubtle}
      transition={{ delay }}
      className="rounded-[1.75rem] border border-accent/20 bg-gradient-to-br from-accent/[0.07] via-surface/70 to-background/30 p-6 sm:p-7"
    >
      <p className="text-[10px] uppercase tracking-[0.28em] text-accent">
        Current Mission
      </p>
      <ul className="mt-5 space-y-3.5">
        {missions.map((mission, index) => (
          <motion.li
            key={mission.id}
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: delay + 0.06 + index * 0.05 }}
            className="flex items-start gap-3 text-sm leading-relaxed text-foreground/90"
          >
            <span
              className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent"
              aria-hidden
            />
            {mission.text}
          </motion.li>
        ))}
      </ul>
      <p className="mt-5 border-t border-border/50 pt-4 text-[10px] uppercase tracking-[0.16em] text-muted/70">
        Updated as the company moves forward
      </p>
    </motion.article>
  );
}
