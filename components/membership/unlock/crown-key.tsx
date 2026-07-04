"use client";

import { motion } from "framer-motion";
import {
  DAEDALUS_WARM_LIGHT,
  EASE_MECHANICAL,
  EASE_WEIGHTED,
  type DaedalusCeremonyPhase,
  type DaedalusPhaseMs,
} from "@/lib/membership/unlock-daedalus";

interface CrownKeyProps {
  phase: DaedalusCeremonyPhase | "hidden";
  phaseMs: Pick<
    DaedalusPhaseMs,
    | "approach"
    | "insert"
    | "insertPauseOffset"
    | "insertPauseDuration"
    | "turn"
    | "turnBounceOffset"
  >;
  className?: string;
}

const APPROACH_Y = 52;
const INSERT_Y = APPROACH_Y - 12;

/** Brushed-metal key — Daedalus v1 z-depth approach, insert resistance, shaft turn */
export function CrownKey({ phase, phaseMs, className = "" }: CrownKeyProps) {
  const hidden = phase === "hidden" || phase === "fade";
  const showShadow = !hidden;

  const insertPauseRatio =
    phaseMs.insert > 0 ? phaseMs.insertPauseOffset / phaseMs.insert : 0.625;
  const insertResumeRatio =
    phaseMs.insert > 0
      ? (phaseMs.insertPauseOffset + phaseMs.insertPauseDuration) / phaseMs.insert
      : 0.825;

  const turnBounceRatio =
    phaseMs.turn > 0 ? phaseMs.turnBounceOffset / phaseMs.turn : 0.5;

  const containerAnimate = (() => {
    if (hidden) {
      return { opacity: 0, y: 180, scale: 0.6, rotate: -3 };
    }
    if (phase === "approach") {
      return { opacity: 1, y: APPROACH_Y, scale: 1, rotate: 0 };
    }
    if (phase === "insert") {
      return {
        opacity: 1,
        y: [APPROACH_Y, APPROACH_Y - 8, APPROACH_Y - 8, INSERT_Y],
        scale: 1,
        rotate: 0,
      };
    }
    return { opacity: 1, y: INSERT_Y, scale: 1, rotate: 0 };
  })();

  const containerTransition = (() => {
    if (phase === "approach") {
      return { duration: phaseMs.approach / 1000, ease: EASE_WEIGHTED };
    }
    if (phase === "insert") {
      return {
        duration: phaseMs.insert / 1000,
        times: [0, insertPauseRatio, insertResumeRatio, 1],
        ease: EASE_WEIGHTED,
      };
    }
    return { duration: 0.01 };
  })();

  const keyRotate =
    phase === "turn"
      ? [-0, -90, -88, -90]
      : phase === "release" || phase === "bloom" || phase === "reveal"
        ? -90
        : 0;

  const keyTransition =
    phase === "turn"
      ? {
          duration: phaseMs.turn / 1000,
          times: [0, turnBounceRatio, turnBounceRatio + 0.08, 1],
          ease: EASE_MECHANICAL,
        }
      : { duration: 0.01 };

  return (
    <div className={`relative ${className}`}>
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[88%] h-3 w-[72%] -translate-x-1/2 rounded-[100%] bg-black/50 blur-md"
        initial={{ opacity: 0, scale: 0.35 }}
        animate={
          showShadow
            ? phase === "approach"
              ? { opacity: 0.5, scale: 1 }
              : { opacity: 0.55, scale: 1 }
            : { opacity: 0, scale: 0.35 }
        }
        transition={
          phase === "approach"
            ? { duration: phaseMs.approach / 1000, ease: EASE_WEIGHTED }
            : { duration: 0.25 }
        }
      />

      <motion.div
        initial={{ opacity: 0, y: 180, scale: 0.6, rotate: -3 }}
        animate={containerAnimate}
        transition={containerTransition}
        style={{
          filter: "drop-shadow(0 14px 28px rgba(0,0,0,0.48))",
          transformPerspective: 900,
        }}
      >
        <motion.svg
          viewBox="0 0 100 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
          animate={{ rotate: keyRotate }}
          transition={keyTransition}
          style={{ originX: "50px", originY: "42px" }}
        >
          <defs>
            <linearGradient id="keyMetal" x1="0" y1="0" x2="100" y2="200">
              <stop offset="0%" stopColor="#eceff2" />
              <stop offset="40%" stopColor="#b8bcc4" />
              <stop offset="100%" stopColor="#7a8088" />
            </linearGradient>
            <radialGradient id="bowFace" cx="50%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#f5f7fa" />
              <stop offset="100%" stopColor="#a8adb5" />
            </radialGradient>
            <radialGradient id="keyWarmCatch" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={DAEDALUS_WARM_LIGHT} stopOpacity="0.18" />
              <stop offset="100%" stopColor={DAEDALUS_WARM_LIGHT} stopOpacity="0" />
            </radialGradient>
          </defs>

          {(phase === "release" || phase === "bloom" || phase === "reveal") && (
            <circle cx="50" cy="42" r="34" fill="url(#keyWarmCatch)" />
          )}

          <circle cx="50" cy="42" r="36" fill="url(#bowFace)" stroke="#c8ccd4" strokeWidth="1.5" />
          <circle cx="50" cy="42" r="32" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
          <ellipse cx="42" cy="32" rx="14" ry="8" fill="rgba(255,255,255,0.2)" />

          <path
            d="M50 22 L54 30 L62 30 L56 36 L58 44 L50 39 L42 44 L44 36 L38 30 L46 30 Z"
            fill="none"
            stroke="#8a9099"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <circle cx="50" cy="42" r="10" fill="#1a1c20" opacity="0.7" />

          <rect x="44" y="76" width="12" height="88" rx="3" fill="url(#keyMetal)" />
          <rect x="46" y="78" width="4" height="84" rx="1" fill="rgba(255,255,255,0.25)" />

          <rect x="40" y="158" width="20" height="6" rx="1.5" fill="url(#keyMetal)" />
          <rect x="38" y="168" width="16" height="5" rx="1.5" fill="url(#keyMetal)" />
          <rect x="46" y="176" width="12" height="5" rx="1.5" fill="url(#keyMetal)" />
        </motion.svg>
      </motion.div>
    </div>
  );
}
