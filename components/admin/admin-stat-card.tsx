"use client";

import { motion, useReducedMotion } from "framer-motion";

const easeLuxury = [0.22, 1, 0.36, 1] as const;

interface AdminStatCardProps {
  label: string;
  value: string;
  detail?: string;
  index: number;
}

export function AdminStatCard({ label, value, detail, index }: AdminStatCardProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduceMotion ? 0.15 : 0.75,
        delay: reduceMotion ? 0 : 0.08 * index,
        ease: easeLuxury,
      }}
      className="group relative overflow-hidden rounded-[1.75rem] border border-border bg-surface/80 p-6 sm:p-7"
    >
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-accent/[0.06] blur-2xl transition-opacity duration-500 group-hover:opacity-100" />
      <p className="text-[10px] uppercase tracking-[0.28em] text-muted">{label}</p>
      <p className="mt-5 font-serif text-4xl font-light tracking-tight text-foreground sm:text-5xl">
        {value}
      </p>
      {detail && (
        <p className="mt-3 text-sm leading-relaxed text-muted/90">{detail}</p>
      )}
    </motion.article>
  );
}
