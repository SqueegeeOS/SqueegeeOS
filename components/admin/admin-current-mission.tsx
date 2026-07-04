"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { CurrentMission } from "@/lib/admin/current-mission";
import { materialize } from "@/lib/motion/system";
import { useBootLayerDelay } from "@/components/motion/boot-provider";
import { CursorSurface } from "@/components/motion/cursor-surface";
import { MissionReveal } from "@/components/motion/mission-reveal";

interface AdminCurrentMissionProps {
  missions: CurrentMission[];
}

export function AdminCurrentMission({ missions }: AdminCurrentMissionProps) {
  const reduceMotion = useReducedMotion();
  const delay = useBootLayerDelay("missions");

  return (
    <CursorSurface
      as="article"
      className="rounded-[1.75rem] border border-accent/20 bg-gradient-to-br from-accent/[0.07] via-surface/70 to-background/30 p-6 sm:p-7"
    >
      <motion.div
        initial={reduceMotion ? false : "hidden"}
        animate="visible"
        variants={materialize}
        transition={{ delay }}
      >
        <p className="text-[10px] uppercase tracking-[0.28em] text-accent">
          Current Mission
        </p>
        <MissionReveal missions={missions} className="mt-5" />
        <p className="mt-5 border-t border-border/50 pt-4 text-[10px] uppercase tracking-[0.16em] text-muted/70">
          Updated as the company moves forward
        </p>
      </motion.div>
    </CursorSurface>
  );
}
