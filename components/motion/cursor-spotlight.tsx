"use client";

import {
  motion,
  useMotionTemplate,
  useReducedMotion,
  useSpring,
} from "framer-motion";
import { useCallback, useEffect, useState, type ReactNode } from "react";

export type CursorSpotlightIntensity =
  | "whisper"
  | "subtle"
  | "medium"
  | "bright";

const INTENSITY: Record<
  CursorSpotlightIntensity,
  { core: number; halo: number; size: number }
> = {
  whisper: { core: 0.028, halo: 0.014, size: 520 },
  subtle: { core: 0.09, halo: 0.045, size: 560 },
  medium: { core: 0.12, halo: 0.06, size: 680 },
  bright: { core: 0.16, halo: 0.08, size: 800 },
};

const SPRING: Record<
  CursorSpotlightIntensity,
  { stiffness: number; damping: number; mass: number }
> = {
  whisper: { stiffness: 38, damping: 24, mass: 1.4 },
  subtle: { stiffness: 90, damping: 26, mass: 0.7 },
  medium: { stiffness: 140, damping: 28, mass: 0.45 },
  bright: { stiffness: 140, damping: 28, mass: 0.45 },
};

function shouldDisableCursorWake(): boolean {
  if (typeof window === "undefined") return true;

  const finePointer = window.matchMedia("(pointer: fine)").matches;
  if (!finePointer) return true;

  const nav = navigator as Navigator & {
    hardwareConcurrency?: number;
    connection?: { saveData?: boolean };
  };

  if (nav.connection?.saveData) return true;
  if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 4) {
    return true;
  }

  return false;
}

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
  const spring = SPRING[intensity];

  const pointerX = useSpring(50, spring);
  const pointerY = useSpring(38, spring);

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

    const active = !shouldDisableCursorWake();
    setEnabled(active);
    if (!active) return;

    window.addEventListener("pointermove", handleMove, { passive: true });
    return () => window.removeEventListener("pointermove", handleMove);
  }, [handleMove, reduceMotion]);

  const zClass = overlay ? "z-[60]" : scope === "fixed" ? "z-[1]" : "z-0";
  const positionClass =
    scope === "fixed"
      ? `pointer-events-none fixed inset-0 ${zClass}`
      : `pointer-events-none absolute inset-0 ${zClass}`;

  const useOverlayBlend = overlay && intensity !== "whisper";
  const blendStyle = useOverlayBlend
    ? ({ mixBlendMode: "soft-light" as const })
    : undefined;

  const staticGlowOpacity = intensity === "whisper" ? 0.035 : 0.06;

  const staticGlow = (
    <div
      aria-hidden
      className={`${positionClass} ${className}`}
      style={{
        ...blendStyle,
        background: `radial-gradient(ellipse at 50% 28%, rgba(255,248,235,${staticGlowOpacity}), transparent 58%)`,
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
  intensity = "whisper",
}: {
  children: ReactNode;
  intensity?: CursorSpotlightIntensity;
}) {
  const overlay = intensity !== "whisper";

  return (
    <div className="relative isolate min-h-screen overflow-x-hidden bg-background">
      <CursorSpotlight scope="fixed" overlay={overlay} intensity={intensity} />
      <div className="relative z-[2]">{children}</div>
    </div>
  );
}
