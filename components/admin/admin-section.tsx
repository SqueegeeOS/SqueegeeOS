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
      className="rounded-[2rem] border border-border/80 bg-surface/55 p-6 backdrop-blur-sm sm:p-8"
    >
      <p className="text-[10px] uppercase tracking-[0.28em] text-accent">
        {eyebrow}
      </p>
      <h2 className="mt-3 font-serif text-2xl font-light text-foreground sm:text-3xl">
        {title}
      </h2>
      {description && (
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          {description}
        </p>
      )}
      <div className="mt-6">{children}</div>
    </motion.section>
  );
}
