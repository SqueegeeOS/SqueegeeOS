"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { GlassCard } from "@/components/craft/glass-card";
import { craftHeading } from "@/lib/craft/tokens";
import { materialize } from "@/lib/motion/system";

interface PortalSectionProps {
  eyebrow?: string;
  headline: ReactNode;
  support?: ReactNode;
  children?: ReactNode;
  index?: number;
  className?: string;
  id?: string;
}

export function PortalSection({
  eyebrow,
  headline,
  support,
  children,
  index = 0,
  className = "",
  id,
}: PortalSectionProps) {
  const reduceMotion = useReducedMotion();
  const delay = reduceMotion ? 0 : 0.08 + index * 0.07;

  return (
    <motion.section
      id={id}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      variants={materialize}
      transition={{ delay }}
      className={`scroll-mt-6 ${className}`}
    >
      {eyebrow ? <p className="mb-3 text-xs font-medium uppercase tracking-[0.12em] text-accent">{eyebrow}</p> : null}
      <h2
        className={`${craftHeading} text-[1.75rem] leading-[1.12] sm:text-4xl`}
      >
        {headline}
      </h2>
      {support ? (
        <p className="mt-5 max-w-[38rem] text-sm leading-[1.65] text-muted [text-wrap:balance] sm:text-[0.9375rem]">
          {support}
        </p>
      ) : null}
      {children ? <div className="mt-8">{children}</div> : null}
    </motion.section>
  );
}

export function PortalCard({
  children,
  className = "",
  index = 0,
}: {
  children: ReactNode;
  className?: string;
  index?: number;
}) {
  return (
    <GlassCard tone="default" motion="materialize" index={index} className={className}>
      {children}
    </GlassCard>
  );
}
