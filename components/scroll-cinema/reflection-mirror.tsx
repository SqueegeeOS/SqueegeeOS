"use client";

import { useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { useInViewAnimation } from "./use-in-view-animation";

interface ReflectionMirrorProps {
  children: ReactNode;
  intensity?: number;
  blurPx?: number;
  className?: string;
}

export function ReflectionMirror({
  children,
  intensity = 0.35,
  blurPx = 8,
  className = "",
}: ReflectionMirrorProps) {
  const reduceMotion = useReducedMotion();
  const { ref, inView, ratio } = useInViewAnimation();

  const reflectionOpacity = reduceMotion
    ? 0
    : inView
      ? Math.min(intensity, ratio * intensity * 1.4)
      : 0;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <div className="reflection-content">{children}</div>

      {!reduceMotion && (
        <>
          <div
            className="h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent"
            aria-hidden
          />
          <div
            aria-hidden
            className="pointer-events-none select-none overflow-hidden"
            style={{
              transform: "scaleY(-1)",
              opacity: reflectionOpacity,
              filter: `blur(${blurPx}px)`,
              maskImage:
                "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 70%)",
              WebkitMaskImage:
                "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 70%)",
              transition: "opacity 0.3s ease",
            }}
          >
            {children}
          </div>
        </>
      )}
    </div>
  );
}
