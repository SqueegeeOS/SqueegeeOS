import React from "react";
import { interpolate } from "remotion";

/**
 * The Atlas Ring — HomeAtlas motion mark, ported 1:1 from
 * components/theme/atlas-mark.tsx, but driven deterministically by
 * the Remotion frame instead of CSS animation.
 */
export const AtlasMark: React.FC<{
  size?: number;
  frame: number;
  color?: string;
  accent?: string;
  /** Frame at which the roofline starts drawing itself. */
  drawStart?: number;
}> = ({ size = 44, frame, color = "#f5f2eb", accent = "#c9b896", drawStart = 0 }) => {
  const local = Math.max(0, frame - drawStart);
  // Quiet counter-rotating drift, matching the app's calibration idle.
  const rotA = frame * 0.16;
  const rotB = -frame * 0.16;
  const roof = interpolate(local, [6, 40], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const hearth = interpolate(local, [34, 52], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
      <g style={{ transformOrigin: "32px 32px", transform: `rotate(${rotA}deg)` }}>
        <circle
          cx="32" cy="32" r="28"
          stroke={color} strokeOpacity="0.3" strokeWidth="1.1"
          strokeDasharray="10 7 32 7 48 7" strokeLinecap="round"
        />
      </g>
      <g style={{ transformOrigin: "32px 32px", transform: `rotate(${rotB}deg)` }}>
        <circle
          cx="32" cy="32" r="21.5"
          stroke={color} strokeOpacity="0.42" strokeWidth="1.1"
          strokeDasharray="6 5 20 5 36 5" strokeLinecap="round"
        />
      </g>
      <path
        d="M18 36 L32 22 L46 36"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={roof}
      />
      <circle
        cx="32" cy="40" r="2.6"
        fill={accent}
        opacity={hearth}
        style={{ transformOrigin: "32px 40px", transform: `scale(${0.4 + 0.6 * hearth})` }}
      />
    </svg>
  );
};
