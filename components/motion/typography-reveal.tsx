"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { headlineLine, headlineWord, spring } from "@/lib/motion/system";

export function HeadlineReveal({
  text,
  className = "",
  delay = 0,
  wordDelay = 0.04,
  as: Tag = "span",
  mode = "line",
}: {
  text: string;
  className?: string;
  delay?: number;
  wordDelay?: number;
  as?: "h1" | "h2" | "h3" | "span" | "p";
  /** Prefer `line` for product UI; `word` only for ceremonies. */
  mode?: "line" | "word";
}) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    const Static = Tag;
    return <Static className={className}>{text}</Static>;
  }

  if (mode === "line") {
    const MotionTag = motion[Tag as "span"];
    return (
      <MotionTag
        className={className}
        variants={headlineLine}
        initial="hidden"
        animate="visible"
        transition={{ delay }}
      >
        {text}
      </MotionTag>
    );
  }

  const words = text.split(/\s+/).filter(Boolean);
  const MotionTag = motion[Tag as "span"];

  return (
    <MotionTag className={className}>
      {words.map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          variants={headlineWord}
          initial="hidden"
          animate="visible"
          transition={{ delay: delay + index * wordDelay }}
          className="inline-block"
          style={{ marginRight: "0.25em" }}
        >
          {word}
        </motion.span>
      ))}
    </MotionTag>
  );
}

export function LineReveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <p className={className}>{children}</p>;
  }

  return (
    <motion.p
      className={className}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, ...spring.settle }}
    >
      {children}
    </motion.p>
  );
}
