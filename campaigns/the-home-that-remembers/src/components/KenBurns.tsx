import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";

interface View {
  scale: number;
  /** 0–1 focus point of the image that should sit at frame center. */
  x: number;
  y: number;
}

/**
 * Deterministic digital camera movement over the master still —
 * continuity-safe motion (crop/push/drift) with no generation involved.
 */
export const KenBurns: React.FC<{
  src: string;
  from: View;
  to: View;
  durationInFrames: number;
}> = ({ src, from, to, durationInFrames }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateRight: "clamp",
    easing: (v) => 1 - Math.pow(1 - v, 2),
  });
  const scale = from.scale + (to.scale - from.scale) * t;
  const x = from.x + (to.x - from.x) * t;
  const y = from.y + (to.y - from.y) * t;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Img
        src={staticFile(src)}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transformOrigin: `${x * 100}% ${y * 100}%`,
          transform: `scale(${scale})`,
        }}
      />
    </AbsoluteFill>
  );
};
