"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { spring } from "@/lib/motion/system";
import { emitSound } from "@/lib/motion/sound-events";

export function StatusPulse({
  active,
  children,
  className = "",
}: {
  active: boolean;
  children: ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const [pulseKey, setPulseKey] = useState(0);

  useEffect(() => {
    if (!active || reduceMotion) return;
    setPulseKey((k) => k + 1);
  }, [active, reduceMotion]);

  return (
    <div className={`relative ${className}`}>
      {!reduceMotion && active && (
        <motion.span
          key={pulseKey}
          aria-hidden
          className="pointer-events-none absolute -inset-px rounded-[inherit] border border-accent/20"
          initial={{ opacity: 0.35 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        />
      )}
      {children}
    </div>
  );
}

export function LuxuryButton({
  children,
  className = "",
  onClick,
  type = "button",
  disabled,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.button
      type={type}
      disabled={disabled}
      onClick={() => {
        if (!reduceMotion) emitSound("surface.tap");
        onClick?.();
      }}
      whileTap={reduceMotion || disabled ? undefined : { scale: 0.97, y: 1 }}
      whileHover={
        reduceMotion || disabled
          ? undefined
          : { scale: 1.015, transition: spring.magnetic }
      }
      transition={spring.press}
      className={`relative overflow-hidden ${className}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
      />
      {children}
    </motion.button>
  );
}
