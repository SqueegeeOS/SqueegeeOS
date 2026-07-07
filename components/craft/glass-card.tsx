"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useRef, type ReactNode } from "react";
import { materialize, riseSubtle } from "@/lib/motion/system";
import { useRimPointer } from "./use-rim-pointer";

type GlassCardTone = "default" | "elevated" | "subtle" | "inset";
type GlassCardMotion = "none" | "materialize" | "rise";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
  tone?: GlassCardTone;
  motion?: GlassCardMotion;
  index?: number;
  padding?: "none" | "sm" | "md" | "lg";
  /** One hero surface per view — directional champagne edge. */
  rim?: boolean;
}

const toneClass: Record<GlassCardTone, string> = {
  default: "craft-glass shadow-[var(--shadow-float)]",
  elevated: "craft-glass-elevated shadow-[var(--shadow-lift)]",
  subtle: "craft-glass-subtle shadow-[var(--shadow-ambient)]",
  inset: "craft-glass-inset",
};

const paddingClass: Record<NonNullable<GlassCardProps["padding"]>, string> = {
  none: "",
  sm: "p-4 sm:p-5",
  md: "p-5 sm:p-6",
  lg: "p-6 sm:p-8",
};

function joinClasses(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function GlassCard({
  children,
  className = "",
  as = "div",
  tone = "default",
  motion: motionKind = "none",
  index = 0,
  padding = "md",
  rim = false,
}: GlassCardProps) {
  const reduceMotion = useReducedMotion();
  const rimRef = useRef<HTMLDivElement>(null);
  useRimPointer(rimRef, rim);

  const variants = motionKind === "rise" ? riseSubtle : materialize;
  const delay = reduceMotion ? 0 : index * 0.06;

  const classes = joinClasses(
    "rounded-[var(--radius-card)]",
    toneClass[tone],
    paddingClass[padding],
    rim && "craft-rim",
    className,
  );

  const setRef = (node: HTMLDivElement | null) => {
    rimRef.current = node;
  };

  if (motionKind === "none") {
    if (as === "section") {
      return (
        <section ref={setRef} className={classes}>
          {children}
        </section>
      );
    }
    if (as === "article") {
      return (
        <article ref={setRef} className={classes}>
          {children}
        </article>
      );
    }
    return (
      <div ref={setRef} className={classes}>
        {children}
      </div>
    );
  }

  if (as === "section") {
    return (
      <motion.section
        ref={setRef}
        initial={reduceMotion ? false : "hidden"}
        animate="visible"
        variants={variants}
        transition={{ delay }}
        className={classes}
      >
        {children}
      </motion.section>
    );
  }

  if (as === "article") {
    return (
      <motion.article
        ref={setRef}
        initial={reduceMotion ? false : "hidden"}
        animate="visible"
        variants={variants}
        transition={{ delay }}
        className={classes}
      >
        {children}
      </motion.article>
    );
  }

  return (
    <motion.div
      ref={setRef}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      variants={variants}
      transition={{ delay }}
      className={classes}
    >
      {children}
    </motion.div>
  );
}
