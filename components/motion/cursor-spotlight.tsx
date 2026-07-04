"use client";

import {
  motion,
  useMotionTemplate,
  useReducedMotion,
  useSpring,
} from "framer-motion";
import { useCallback, useEffect, useState, type ReactNode } from "react";

export type CursorSpotlightIntensity = "subtle" | "medium" | "bright";

const INTENSITY: Record<
  CursorSpotlightIntensity,
  { core: number; halo: number; size: number }
> = {
  subtle: { core: 0.09, halo: 0.045, size: 560 },
  medium: { core: 0.12, halo: 0.06, size: 680 },
  bright: { core: 0.16, halo: 0.08, size: 800 },
};

interface CursorSpotlightProps {
  /** `fixed` — full viewport (landing, marketing). `absolute` — contained in parent. */
  scope?: "fixed" | "absolute";
  /** When true, renders above siblings so the glow is visible on opaque surfaces. */
  overlay?: boolean;
  intensity?: CursorSpotlightIntensity;
  className?: string;
  children?: ReactNode;
}

/**
 * Soft light that follows the pointer — warm ivory core, champagne halo.
 * Site-wide ready: mount once at page or layout root with scope="fixed".
 */
export function CursorSpotlight({
  scope = "fixed",
  overlay = false,
  intensity = "medium",
  className = "",
  children,
}: CursorSpotlightProps) {
  const reduceMotion = useReducedMotion();
  const [enabled, setEnabled] = useState(false);
  const { core, halo, size } = INTENSITY[intensity];

  const pointerX = useSpring(50, { stiffness: 140, damping: 28, mass: 0.45 });
  const pointerY = useSpring(38, { stiffness: 140, damping: 28, mass: 0.45 });

  const spotlight = useMotionTemplate`radial-gradient(${size}px circle at ${pointerX}% ${pointerY}%, rgba(255, 248, 235, ${core}) 0%, rgba(201, 184, 150, ${halo}) 22%, transparent 52%)`;

  const handleMove = useCallback(
    (event: PointerEvent) => {
      pointerX.set((event.clientX / window.innerWidth) * 100);
      pointerY.set((event.clientY / window.innerHeight) * 100);
    },
    [pointerX, pointerY],
  );

  useEffect(() => {
    if (reduceMotion) return;

    const finePointer = window.matchMedia("(pointer: fine)").matches;
    setEnabled(finePointer);
    if (!finePointer) return;

    window.addEventListener("pointermove", handleMove, { passive: true });
    return () => window.removeEventListener("pointermove", handleMove);
  }, [handleMove, reduceMotion]);

  const zClass = overlay ? "z-[60]" : scope === "fixed" ? "z-[1]" : "z-0";
  const positionClass =
    scope === "fixed"
      ? `pointer-events-none fixed inset-0 ${zClass}`
      : `pointer-events-none absolute inset-0 ${zClass}`;

  const blendStyle = overlay
    ? ({ mixBlendMode: "soft-light" as const })
    : undefined;

  const staticGlow = (
    <div
      aria-hidden
      className={`${positionClass} ${className}`}
      style={{
        ...blendStyle,
        background:
          "radial-gradient(ellipse at 50% 28%, rgba(255,248,235,0.06), transparent 58%)",
      }}
    />
  );

  if (reduceMotion || !enabled) {
    return (
      <>
        {staticGlow}
        {children}
      </>
    );
  }

  return (
    <>
      <motion.div
        aria-hidden
        className={`${positionClass} ${className}`}
        style={{ background: spotlight, ...blendStyle }}
      />
      {children}
    </>
  );
}

/** Wrapper for marketing pages — spotlight + content stack. */
export function CursorSpotlightPage({
  children,
  intensity = "medium",
}: {
  children: ReactNode;
  intensity?: CursorSpotlightIntensity;
}) {
  return (
    <div className="relative isolate min-h-screen overflow-x-hidden bg-background">
      <div className="relative z-[2]">{children}</div>
      <CursorSpotlight scope="fixed" overlay intensity={intensity} />
    </div>
  );
}
