"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
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
      className="border-t border-border/25 pt-12 first:border-t-0 first:pt-0"
    >
      <p className="text-[10px] uppercase tracking-[0.28em] text-muted/80">
        {eyebrow}
      </p>
      <h2 className="mt-2 font-serif text-2xl font-light tracking-[-0.015em] text-foreground sm:text-[1.75rem]">
        {title}
      </h2>
      {description ? (
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          {description}
        </p>
      ) : null}
      <div className="mt-8">{children}</div>
    </motion.section>
  );
}
