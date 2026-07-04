"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

const easeOut = [0, 0, 0.2, 1] as const;

export function RollingPrice({
  value,
  className = "",
  duration = 0.3,
}: {
  value: number;
  className?: string;
  duration?: number;
}) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (reduceMotion) {
      setDisplay(value);
      return;
    }

    const start = display;
    const delta = value - start;
    if (delta === 0) return;

    const startTime = performance.now();
    const ms = duration * 1000;

    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(start + delta * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animate from last rendered value
  }, [value, duration, reduceMotion]);

  return (
    <span className={className}>
      ${display.toLocaleString("en-US")}
    </span>
  );
}

export function FadePriceBlock({
  children,
  priceKey,
}: {
  children: ReactNode;
  priceKey: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      key={priceKey}
      initial={reduceMotion ? false : { opacity: 0.72 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: easeOut }}
    >
      {children}
    </motion.div>
  );
}
