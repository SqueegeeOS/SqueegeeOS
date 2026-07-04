"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, type ReactNode } from "react";
import { materialize } from "@/lib/motion/system";
import { emitSound } from "@/lib/motion/sound-events";
import type { BootLayerKey } from "@/lib/motion/boot-sequence";
import { useBootLayerDelay } from "./boot-provider";

export function BootLayer({
  layer,
  index = 0,
  children,
  className,
  onSettled,
}: {
  layer: BootLayerKey;
  index?: number;
  children: ReactNode;
  className?: string;
  onSettled?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const delay = useBootLayerDelay(layer, index);

  useEffect(() => {
    if (reduceMotion || !onSettled) return;
    const ms = delay * 1000 + 600;
    const timer = window.setTimeout(onSettled, ms);
    return () => window.clearTimeout(timer);
  }, [delay, onSettled, reduceMotion]);

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      variants={materialize}
      transition={{ delay }}
      onAnimationComplete={() => {
        if (!reduceMotion) emitSound("boot.layer", { layer, index });
      }}
    >
      {children}
    </motion.div>
  );
}
