"use client";

import { useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { useScrollProgress } from "./use-scroll-progress";

interface ParallaxLayerProps {
  children: ReactNode;
  depth?: number;
  className?: string;
}

export function ParallaxLayer({
  children,
  depth = 0.15,
  className = "",
}: ParallaxLayerProps) {
  const reduceMotion = useReducedMotion();
  const { progress, direction } = useScrollProgress();

  const offset = reduceMotion
    ? 0
    : (progress - 0.5) * depth * 120 * (direction === "down" ? 1 : -1);

  return (
    <div
      className={className}
      style={{
        transform: reduceMotion ? undefined : `translate3d(0, ${offset}px, 0)`,
        willChange: reduceMotion ? undefined : "transform",
      }}
    >
      {children}
    </div>
  );
}
