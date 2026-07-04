"use client";

import { motion, useReducedMotion } from "framer-motion";
import { riseSubtle } from "@/lib/motion/system";
import { useBootLayerDelay } from "@/components/motion/boot-provider";
import { CountValue } from "@/components/motion/count-value";

interface AdminStatCardProps {
  label: string;
  value: string;
  detail?: string;
  index: number;
  awaitingData?: boolean;
}

export function AdminStatCard({
  label,
  value,
  detail,
  index,
  awaitingData = false,
}: AdminStatCardProps) {
  const reduceMotion = useReducedMotion();
  const delay = useBootLayerDelay("statCards", index);

  return (
    <motion.article
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      variants={riseSubtle}
      transition={{ delay }}
      className="rounded-[1.75rem] border border-border bg-surface/80 p-6 sm:p-7"
    >
      <p className="text-[10px] uppercase tracking-[0.28em] text-muted">
        {label}
      </p>
      <p className="mt-5 font-serif text-4xl font-light tracking-tight text-foreground sm:text-5xl">
        <CountValue value={value} delay={delay + 0.08} duration={0.85} />
      </p>
      {awaitingData ? (
        <span className="mt-3 inline-flex rounded-full border border-border/80 bg-background/50 px-2.5 py-1 text-[9px] uppercase tracking-[0.2em] text-muted/80">
          Awaiting Data
        </span>
      ) : (
        detail && (
          <p className="mt-3 text-sm leading-relaxed text-muted/90">{detail}</p>
        )
      )}
    </motion.article>
  );
}
