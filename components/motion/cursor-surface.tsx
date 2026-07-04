"use client";

import { motion, useMotionTemplate, useMotionValue, useReducedMotion } from "framer-motion";
import { useCallback, useRef, type ReactNode } from "react";
import { spring } from "@/lib/motion/system";

interface CursorSurfaceProps {
  children: ReactNode;
  className?: string;
  as?: "article" | "div" | "section";
  disabled?: boolean;
  id?: string;
}

/** Reserved for primary interactive panels — not every card on the page. */
export function CursorSurface({
  children,
  className = "",
  as = "article",
  disabled = false,
  id,
}: CursorSurfaceProps) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const mx = useMotionValue(50);
  const my = useMotionValue(50);

  const highlight = useMotionTemplate`radial-gradient(420px circle at ${mx}% ${my}%, rgba(201,184,150,0.07), transparent 45%)`;

  const handleMove = useCallback(
    (event: React.PointerEvent) => {
      if (reduceMotion || disabled) return;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      mx.set(((event.clientX - rect.left) / rect.width) * 100);
      my.set(((event.clientY - rect.top) / rect.height) * 100);
    },
    [disabled, mx, my, reduceMotion],
  );

  const Component = motion[as];

  if (reduceMotion || disabled) {
    const Static = as;
    return (
      <Static id={id} className={className}>
        {children}
      </Static>
    );
  }

  return (
    <Component
      id={id}
      ref={ref as React.RefObject<HTMLDivElement>}
      onPointerMove={handleMove}
      whileHover={{ scale: 1.008, transition: spring.magnetic }}
      className={`group relative overflow-hidden ${className}`}
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: highlight }}
      />
      <div className="relative z-[1]">{children}</div>
    </Component>
  );
}
