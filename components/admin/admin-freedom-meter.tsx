"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { FreedomMeter } from "@/lib/admin/freedom-meter";

const easeLuxury = [0.22, 1, 0.36, 1] as const;

interface AdminFreedomMeterProps {
  meter: FreedomMeter;
}

export function AdminFreedomMeter({ meter }: AdminFreedomMeterProps) {
  const reduceMotion = useReducedMotion();

  return (
    <article className="rounded-[1.75rem] border border-accent/20 bg-gradient-to-br from-accent/[0.06] via-surface/60 to-background/40 p-6 sm:p-7">
      <p className="text-[10px] uppercase tracking-[0.28em] text-accent">
        Freedom Meter
      </p>
      <p className="mt-2 text-xs leading-relaxed text-muted/85">
        Not escape — building a company that runs with intention.
      </p>

      <div className="mt-6 flex items-end gap-5">
        <motion.p
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, ease: easeLuxury }}
          className="font-serif text-5xl font-light tabular-nums text-foreground"
        >
          {meter.score}
        </motion.p>
        <div className="mb-2">
          <p className="font-serif text-lg font-light text-foreground/90">
            {meter.label}
          </p>
          <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted">
            {meter.explanation}
          </p>
        </div>
      </div>

      <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-border/50">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${meter.score}%` }}
          transition={{ duration: 1.2, ease: easeLuxury }}
          className="h-full rounded-full bg-gradient-to-r from-accent/50 to-accent"
        />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {meter.dimensions.map((dim) => (
          <div key={dim.label}>
            <div className="flex justify-between text-[10px] uppercase tracking-[0.14em] text-muted">
              <span>{dim.label}</span>
              <span>{dim.progress}%</span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-border/40">
              <div
                className="h-full rounded-full bg-accent/60 transition-all duration-700"
                style={{ width: `${dim.progress}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
