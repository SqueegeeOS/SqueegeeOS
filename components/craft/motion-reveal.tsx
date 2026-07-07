"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { materialize, riseSubtle, staggerDepth } from "@/lib/motion/system";

type MotionRevealVariant = "materialize" | "rise";

interface MotionRevealProps {
  children: ReactNode;
  className?: string;
  variant?: MotionRevealVariant;
  index?: number;
}

export function MotionReveal({
  children,
  className = "",
  variant = "materialize",
  index = 0,
}: MotionRevealProps) {
  const reduceMotion = useReducedMotion();
  const variants = variant === "rise" ? riseSubtle : materialize;
  const delay = reduceMotion ? 0 : index * 0.06;

  return (
    <motion.div
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      variants={variants}
      transition={{ delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function MotionStagger({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      variants={staggerDepth}
      className={className}
    >
      {children}
    </motion.div>
  );
}
