"use client";

import { useReducedMotion } from "framer-motion";
import { useScrollProgress } from "./use-scroll-progress";

export function AmbientBackground({ className = "" }: { className?: string }) {
  const reduceMotion = useReducedMotion();
  const { progress } = useScrollProgress();

  const shift = reduceMotion ? 50 : 30 + progress * 40;

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden
    >
      <div
        className="absolute left-1/2 top-0 h-[520px] w-[900px] -translate-x-1/2 rounded-full opacity-60 blur-[120px]"
        style={{
          background: `radial-gradient(ellipse, rgba(201,184,150,0.08) 0%, transparent 70%)`,
          transform: `translate(-50%, ${shift}px)`,
          transition: reduceMotion ? "none" : "transform 0.2s linear",
        }}
      />
    </div>
  );
}
