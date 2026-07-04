"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { materialize, riseSubtle } from "@/lib/motion/system";
import type { BootLayerKey } from "@/lib/motion/boot-sequence";
import { useBoot, useBootLayerDelay } from "./boot-provider";

export function BootLayer({
  layer,
  index = 0,
  children,
  className,
  subtle = false,
}: {
  layer: BootLayerKey;
  index?: number;
  children: ReactNode;
  className?: string;
  subtle?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const { profile } = useBoot();
  const delay = useBootLayerDelay(layer, index);

  if (reduceMotion || profile === "none") {
    return <div className={className}>{children}</div>;
  }

  const variants = subtle || profile === "settle" ? riseSubtle : materialize;

  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={variants}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}
