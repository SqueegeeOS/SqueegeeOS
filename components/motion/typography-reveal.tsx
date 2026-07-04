"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { headlineWord } from "@/lib/motion/system";

export function HeadlineReveal({
  text,
  className = "",
  delay = 0,
  wordDelay = 0.055,
  as: Tag = "span",
}: {
  text: string;
  className?: string;
  delay?: number;
  wordDelay?: number;
  as?: "h1" | "h2" | "h3" | "span" | "p";
}) {
  const reduceMotion = useReducedMotion();
  const words = text.split(/\s+/).filter(Boolean);

  if (reduceMotion) {
    const Static = Tag;
    return <Static className={className}>{text}</Static>;
  }

  const MotionTag = motion[Tag as "span"];

  return (
    <MotionTag className={className} aria-label={text}>
      {words.map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          variants={headlineWord}
          initial="hidden"
          animate="visible"
          transition={{ delay: delay + index * wordDelay }}
          className="inline-block"
          style={{ marginRight: "0.28em" }}
          aria-hidden
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
      initial={{ opacity: 0, filter: "blur(8px)", y: 6 }}
      animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
      transition={{ delay, duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.p>
  );
}
