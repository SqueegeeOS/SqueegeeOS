"use client";

import { motion } from "framer-motion";

interface BrassLockProps {
  open?: boolean;
  className?: string;
}

/** Minimal brass/champagne padlock — SVG */
export function BrassLock({ open = false, className = "" }: BrassLockProps) {
  return (
    <svg
      viewBox="0 0 120 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="brassBody" x1="20" y1="50" x2="100" y2="130">
          <stop offset="0%" stopColor="#d4c4a0" />
          <stop offset="45%" stopColor="#b8a078" />
          <stop offset="100%" stopColor="#8a7355" />
        </linearGradient>
        <linearGradient id="brassShackle" x1="30" y1="0" x2="90" y2="60">
          <stop offset="0%" stopColor="#e8dcc4" />
          <stop offset="100%" stopColor="#a89068" />
        </linearGradient>
        <radialGradient id="keyholeGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f5e6c8" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#3d3428" stopOpacity="0.2" />
        </radialGradient>
      </defs>

      <motion.g
        animate={{
          rotate: open ? -28 : 0,
          x: open ? -8 : 0,
          y: open ? -4 : 0,
        }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        style={{ originX: "88px", originY: "52px" }}
      >
        <path
          d="M88 52 C88 28 68 12 60 12 C52 12 32 28 32 52 L32 58 L88 58 Z"
          stroke="url(#brassShackle)"
          strokeWidth="10"
          strokeLinecap="round"
          fill="none"
        />
      </motion.g>

      <rect
        x="22"
        y="58"
        width="76"
        height="72"
        rx="10"
        fill="url(#brassBody)"
        stroke="#c9b896"
        strokeWidth="1"
      />
      <rect
        x="26"
        y="62"
        width="68"
        height="64"
        rx="8"
        fill="none"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="1"
      />
      <circle cx="60" cy="92" r="10" fill="url(#keyholeGlow)" />
      <path
        d="M60 98 L60 112"
        stroke="#2a241c"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
