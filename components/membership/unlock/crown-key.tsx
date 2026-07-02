"use client";

import { motion } from "framer-motion";

interface CrownKeyProps {
  phase: "hidden" | "approach" | "insert" | "turn";
  className?: string;
  motionScale?: number;
}

const easeMechanical = [0.45, 0.05, 0.2, 1] as const;

/** Brushed-metal key with engraved crown — approaches lock head-on */
export function CrownKey({
  phase,
  className = "",
  motionScale = 1,
}: CrownKeyProps) {
  const y =
    phase === "hidden"
      ? 120
      : phase === "approach"
        ? 48
        : phase === "insert"
          ? 22
          : 22;
  const rotate = phase === "turn" ? 72 : 0;
  const opacity = phase === "hidden" ? 0 : 1;

  return (
    <motion.div
      className={className}
      animate={{ y, opacity }}
      transition={{ duration: phase === "approach" ? 1.4 * motionScale : 0.5 * motionScale, ease: easeMechanical }}
      style={{ filter: "drop-shadow(0 10px 24px rgba(0,0,0,0.45))" }}
    >
      <motion.svg
        viewBox="0 0 100 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        animate={{ rotate }}
        transition={{ duration: 0.95 * motionScale, ease: easeMechanical }}
        style={{ originX: "50px", originY: "42px" }}
        aria-hidden
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
        </defs>

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
  );
}
