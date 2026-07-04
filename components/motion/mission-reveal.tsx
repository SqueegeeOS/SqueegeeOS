"use client";

import { motion, useReducedMotion } from "framer-motion";
import { lineReveal } from "@/lib/motion/system";
import { useBootLayerDelay } from "./boot-provider";

export function MissionReveal({
  missions,
  className = "",
}: {
  missions: Array<{ id: string; text: string }>;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const baseDelay = useBootLayerDelay("missions");

  return (
    <ul className={`space-y-3.5 ${className}`}>
      {missions.map((mission, index) => (
        <motion.li
          key={mission.id}
          variants={lineReveal}
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
          transition={{ delay: baseDelay + index * 0.14 }}
          className="flex items-start gap-3 text-sm leading-relaxed text-foreground/90"
        >
          <motion.span
            aria-hidden
            className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent"
            initial={reduceMotion ? false : { scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: baseDelay + index * 0.14 + 0.08 }}
          />
          <span>{mission.text}</span>
        </motion.li>
      ))}
    </ul>
  );
}
