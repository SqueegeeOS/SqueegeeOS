"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { GlassCard } from "@/components/craft/glass-card";
import { craftEyebrow, craftHeading } from "@/lib/craft/tokens";
import { riseSubtle } from "@/lib/motion/system";
import { useBootLayerDelay } from "@/components/motion/boot-provider";

export function AdminSection({
  eyebrow,
  title,
  description,
  children,
  layer = "sections",
  index = 0,
  id,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  layer?: "sections" | "morningBrief" | "missions";
  index?: number;
  id?: string;
}) {
  const reduceMotion = useReducedMotion();
  const delay = useBootLayerDelay(layer, index);

  return (
    <motion.section
      id={id}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      variants={riseSubtle}
      transition={{ delay }}
      className="border-t border-border/15 pt-14 first:border-t-0 first:pt-0"
    >
      <p className={craftEyebrow}>{eyebrow}</p>
      <h2 className={`${craftHeading} mt-3 text-2xl sm:text-[1.75rem]`}>
        {title}
      </h2>
      {description ? (
        <p className="mt-4 max-w-2xl text-sm leading-[1.65] text-muted">
          {description}
        </p>
      ) : null}
      <div className="mt-8">
        <GlassCard tone="subtle" padding="md" motion="none">
          {children}
        </GlassCard>
      </div>
    </motion.section>
  );
}
