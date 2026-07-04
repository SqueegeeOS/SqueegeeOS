"use client";

import { useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { useInViewAnimation } from "./use-in-view-animation";

interface ScrollRevealProps {
  children: ReactNode;
  delay?: number;
  direction?: "up" | "scale" | "fade";
  className?: string;
}

export function ScrollReveal({
  children,
  delay = 0,
  direction = "up",
  className = "",
}: ScrollRevealProps) {
  const reduceMotion = useReducedMotion();
  const { ref, inView } = useInViewAnimation();
  const revealed = reduceMotion || inView;

  const hiddenTransform =
    direction === "scale" ? "scale(0.96)" : "translateY(28px)";

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: revealed ? 1 : 0,
        transform: revealed ? "translateY(0) scale(1)" : hiddenTransform,
        transition: reduceMotion
          ? "none"
          : `opacity 0.8s ease ${delay}ms, transform 0.8s ease ${delay}ms`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}
