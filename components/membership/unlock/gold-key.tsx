"use client";

import { motion } from "framer-motion";

interface GoldKeyProps {
  className?: string;
  rotating?: boolean;
}

/** Elegant gold key — SVG */
export function GoldKey({ className = "", rotating = false }: GoldKeyProps) {
  return (
    <motion.svg
      viewBox="0 0 160 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
      animate={{ rotate: rotating ? 90 : 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      style={{ originX: "24px", originY: "24px" }}
    >
      <defs>
        <linearGradient id="goldKey" x1="0" y1="0" x2="160" y2="48">
          <stop offset="0%" stopColor="#f0e0b8" />
          <stop offset="40%" stopColor="#d4b87a" />
          <stop offset="100%" stopColor="#a88b4a" />
        </linearGradient>
      </defs>
      <circle
        cx="24"
        cy="24"
        r="18"
        fill="url(#goldKey)"
        stroke="#e8d4a8"
        strokeWidth="1.5"
      />
      <circle cx="24" cy="24" r="6" fill="#1a1610" opacity="0.5" />
      <rect x="40" y="20" width="88" height="8" rx="2" fill="url(#goldKey)" />
      <rect x="118" y="16" width="8" height="16" rx="1" fill="url(#goldKey)" />
      <rect x="132" y="18" width="8" height="12" rx="1" fill="url(#goldKey)" />
      <rect x="146" y="20" width="8" height="8" rx="1" fill="url(#goldKey)" />
    </motion.svg>
  );
}
