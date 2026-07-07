"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { materialize, riseSubtle } from "@/lib/motion/system";

type GlassCardTone = "default" | "elevated" | "subtle";
type GlassCardMotion = "none" | "materialize" | "rise";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
  tone?: GlassCardTone;
  motion?: GlassCardMotion;
  index?: number;
  padding?: "none" | "sm" | "md" | "lg";
}

const toneClass: Record<GlassCardTone, string> = {
  default: "craft-glass shadow-[var(--shadow-float)]",
  elevated: "craft-glass-elevated shadow-[var(--shadow-lift)]",
  subtle: "craft-glass-subtle shadow-[var(--shadow-ambient)]",
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
}: GlassCardProps) {
  const reduceMotion = useReducedMotion();
  const variants = motionKind === "rise" ? riseSubtle : materialize;
  const delay = reduceMotion ? 0 : index * 0.06;

  const classes = joinClasses(
    "rounded-[var(--radius-card)]",
    toneClass[tone],
    paddingClass[padding],
    className,
  );

  if (motionKind === "none") {
    if (as === "section") {
      return <section className={classes}>{children}</section>;
    }
    if (as === "article") {
      return <article className={classes}>{children}</article>;
    }
    return <div className={classes}>{children}</div>;
  }

  if (as === "section") {
    return (
      <motion.section
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
