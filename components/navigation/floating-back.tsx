"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { FloatingBackConfig } from "@/lib/navigation/resolve";

const easeLuxury = [0.22, 1, 0.36, 1] as const;

interface FloatingBackProps {
  config: FloatingBackConfig;
}

export function FloatingBack({ config }: FloatingBackProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4, ease: easeLuxury }}
      className={`fixed left-4 z-[55] sm:left-6 ${
        config.bottomClass ?? "bottom-[max(1rem,env(safe-area-inset-bottom))]"
      }`}
    >
      <Link
        href={config.href}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-border/80 bg-background/85 px-4 py-2.5 text-[11px] uppercase tracking-[0.18em] text-muted shadow-[0_8px_28px_rgba(0,0,0,0.22)] backdrop-blur-md transition-colors hover:border-accent/30 hover:text-accent touch-manipulation"
      >
        <span aria-hidden>←</span>
        {config.label.replace("Back to ", "")}
      </Link>
    </motion.div>
  );
}
