"use client";

import { motion } from "framer-motion";

interface ChromePadlockProps {
  open?: boolean;
  className?: string;
  lightEscape?: boolean;
  liteMode?: boolean;
  motionScale?: number;
}

const easeMechanical = [0.45, 0.05, 0.2, 1] as const;

/** High-detail chrome padlock — brushed silver, cinematic depth */
export function ChromePadlock({
  open = false,
  className = "",
  lightEscape = false,
  liteMode = false,
  motionScale = 1,
}: ChromePadlockProps) {
  return (
    <svg
      viewBox="0 0 200 260"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="chromeBody" x1="40" y1="80" x2="160" y2="220">
          <stop offset="0%" stopColor="#e8ecef" />
          <stop offset="35%" stopColor="#b8bcc4" />
          <stop offset="70%" stopColor="#8a9099" />
          <stop offset="100%" stopColor="#6e737a" />
        </linearGradient>
        <linearGradient id="chromeHighlight" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.15" />
        </linearGradient>
        <linearGradient id="shackleMetal" x1="60" y1="0" x2="140" y2="90">
          <stop offset="0%" stopColor="#f0f2f5" />
          <stop offset="45%" stopColor="#c5c9d0" />
          <stop offset="100%" stopColor="#7a8088" />
        </linearGradient>
        <radialGradient id="keyholeDepth" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#1a1a1a" />
          <stop offset="100%" stopColor="#000000" />
        </radialGradient>
        <filter id="metalNoise" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves="2"
            stitchTiles="stitch"
            result="noise"
          />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.55  0 0 0 0.04 0"
            in="noise"
            result="grain"
          />
          <feBlend in="SourceGraphic" in2="grain" mode="overlay" />
        </filter>
        <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g filter={liteMode ? undefined : "url(#metalNoise)"}>
        <motion.g
          animate={{
            rotate: open ? -38 : 0,
            y: open ? -6 : 0,
            x: open ? 10 : 0,
          }}
          transition={{ duration: 0.75 * motionScale, ease: easeMechanical }}
          style={{ originX: "150px", originY: "72px" }}
        >
          <path
            d="M150 72 C150 28 125 8 100 8 C75 8 50 28 50 72 L50 82 L150 82 Z"
            stroke="url(#shackleMetal)"
            strokeWidth="14"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M150 72 C150 28 125 8 100 8 C75 8 50 28 50 72"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
        </motion.g>

        <rect
          x="38"
          y="88"
          width="124"
          height="130"
          rx="18"
          fill="url(#chromeBody)"
        />
        <rect
          x="38"
          y="88"
          width="124"
          height="130"
          rx="18"
          fill="url(#chromeHighlight)"
          opacity="0.35"
        />
        <rect
          x="42"
          y="92"
          width="116"
          height="122"
          rx="15"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="1"
          fill="none"
        />

        <ellipse cx="72" cy="130" rx="22" ry="8" fill="rgba(255,255,255,0.12)" />
        <ellipse cx="128" cy="175" rx="18" ry="6" fill="rgba(0,0,0,0.15)" />

        <circle cx="100" cy="148" r="16" fill="url(#keyholeDepth)" />
        <rect x="94" y="148" width="12" height="28" rx="2" fill="#0a0a0a" />

        {lightEscape && (
          <motion.ellipse
            cx="100"
            cy="155"
            rx="8"
            ry="20"
            fill="#fff8ee"
            filter="url(#softGlow)"
            initial={{ opacity: 0, ry: 10 }}
            animate={{ opacity: 0.75, ry: 36 }}
            transition={{ duration: 1.8 * motionScale, ease: easeMechanical }}
          />
        )}

        <circle cx="52" cy="108" r="4" fill="#9a9ea6" stroke="#d0d4da" strokeWidth="1" />
        <circle cx="148" cy="108" r="4" fill="#9a9ea6" stroke="#d0d4da" strokeWidth="1" />
        <circle cx="52" cy="198" r="4" fill="#9a9ea6" stroke="#d0d4da" strokeWidth="1" />
        <circle cx="148" cy="198" r="4" fill="#9a9ea6" stroke="#d0d4da" strokeWidth="1" />
      </g>
    </svg>
  );
}
