"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { Eyebrow } from "@/components/presentations/slide-primitives";
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
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2 className="font-serif text-[1.75rem] font-light leading-[1.1] tracking-[-0.015em] text-[#f5f2eb] [text-wrap:balance] sm:text-4xl">
        {headline}
      </h2>
      {support ? (
        <p className="mt-4 text-sm leading-relaxed text-white/60 [text-wrap:balance] sm:text-base">
          {support}
        </p>
      ) : null}
      {children ? <div className="mt-6">{children}</div> : null}
    </motion.section>
  );
}

export function PortalCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6 ${className}`}
    >
      {children}
    </div>
  );
}
