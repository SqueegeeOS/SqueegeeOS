"use client";

import { motion, useInView } from "framer-motion";
import { useRef, type ReactNode } from "react";

export const easeLuxury = [0.22, 1, 0.36, 1] as const;

export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-8%" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      transition={{ duration: 0.9, delay, ease: easeLuxury }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-accent sm:tracking-[0.36em]">
      {children}
    </p>
  );
}

export function AmbientGlow() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-accent/[0.04] blur-[120px]" />
    </div>
  );
}
