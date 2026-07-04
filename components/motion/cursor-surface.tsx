"use client";

import { motion, useMotionTemplate, useMotionValue, useReducedMotion } from "framer-motion";
import { useCallback, useRef, type ReactNode } from "react";
import { spring } from "@/lib/motion/system";
import { emitSound } from "@/lib/motion/sound-events";

interface CursorSurfaceProps {
  children: ReactNode;
  className?: string;
  as?: "article" | "div" | "section";
  disabled?: boolean;
  id?: string;
}

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

  const highlight = useMotionTemplate`radial-gradient(520px circle at ${mx}% ${my}%, rgba(201,184,150,0.14), transparent 42%)`;
  const borderGlow = useMotionTemplate`radial-gradient(280px circle at ${mx}% ${my}%, rgba(201,184,150,0.35), transparent 50%)`;

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

  return (
    <Component
      id={id}
      ref={ref as React.RefObject<HTMLDivElement>}
      onPointerMove={handleMove}
      onPointerEnter={() => {
        if (!reduceMotion) emitSound("glass.focus");
      }}
      whileHover={
        reduceMotion || disabled
          ? undefined
          : { scale: 1.002, transition: spring.magnetic }
      }
      className={`group relative overflow-hidden ${className}`}
    >
      {!reduceMotion && !disabled && (
        <>
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-700 group-hover:opacity-100"
            style={{ background: highlight }}
          />
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-700 group-hover:opacity-100"
            style={{
              background: borderGlow,
              mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              maskComposite: "exclude",
              WebkitMaskComposite: "xor",
              padding: "1px",
            }}
          />
        </>
      )}
      <div className="relative z-[1]">{children}</div>
    </Component>
  );
}
