"use client";

/**
 * The Atlas Ring — HomeAtlas motion mark.
 * A roofline held inside two slowly counter-rotating contour rings:
 * the memory rings of a living archive, with an accent point for the
 * home itself. Pure SVG + CSS, themes through currentColor/accent,
 * static under reduced motion.
 */
export function AtlasMark({ size = 44, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
      className={`atlas-mark text-foreground ${className}`}
    >
      {/* outer contour ring */}
      <g className="atlas-mark-ring-a" style={{ transformOrigin: "32px 32px" }}>
        <circle
          cx="32" cy="32" r="28"
          stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.1"
          strokeDasharray="10 7 32 7 48 7" strokeLinecap="round"
        />
      </g>
      {/* inner contour ring, counter-rotating */}
      <g className="atlas-mark-ring-b" style={{ transformOrigin: "32px 32px" }}>
        <circle
          cx="32" cy="32" r="21.5"
          stroke="currentColor" strokeOpacity="0.42" strokeWidth="1.1"
          strokeDasharray="6 5 20 5 36 5" strokeLinecap="round"
        />
      </g>
      {/* the roofline: home, drawn once */}
      <path
        className="atlas-mark-roof"
        d="M18 36 L32 22 L46 36"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        pathLength={1}
      />
      {/* the hearth: you are here */}
      <circle className="atlas-mark-hearth" cx="32" cy="40" r="2.6" fill="var(--accent)" />
    </svg>
  );
}
