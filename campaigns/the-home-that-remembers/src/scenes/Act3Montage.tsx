import React from "react";
import { AbsoluteFill, Sequence, OffthreadVideo, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND } from "../brand";
import { FONTS } from "../fonts";
import { KenBurns } from "../components/KenBurns";

/**
 * 7.5–11.8s — fast, clean montage. HOUSE CONTINUITY RULE: every clip that
 * shows architecture derives from hero-house-master.png (deterministic
 * digital camera moves). The only external clip is a panels-only service
 * detail cropped so no other property is identifiable.
 */

export type MontageClipKind = "master-windows" | "pressure-detail" | "master-finish";

export interface MontageClip {
  kind: MontageClipKind;
  label: string;
}

const ACT_FRAMES = 129;

export const Act3Montage: React.FC<{
  caption: string;
  clips: MontageClip[];
}> = ({ caption, clips }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const compact = height < 1500;
  const per = Math.ceil(ACT_FRAMES / clips.length);

  return (
    <AbsoluteFill style={{ background: BRAND.pineDeep }}>
      {clips.map((c, i) => (
        <Sequence key={`${c.kind}-${i}`} from={i * per} durationInFrames={per} layout="none">
          <Clip clip={c} durationInFrames={per} />
        </Sequence>
      ))}

      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to top, rgba(250,246,236,0.97) 0%, rgba(250,246,236,0.88) 11%, rgba(250,246,236,0) 26%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: compact ? height * 0.032 : height * 0.045,
          textAlign: "center",
          padding: `0 ${width * 0.08}px`,
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: FONTS.serif,
            fontWeight: 400,
            fontSize: compact ? 44 : 52,
            lineHeight: 1.15,
            color: BRAND.pine,
            opacity: interpolate(frame, [4, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          {caption}
        </p>
      </div>
    </AbsoluteFill>
  );
};

const Clip: React.FC<{ clip: MontageClip; durationInFrames: number }> = ({ clip, durationInFrames }) => {
  const local = useCurrentFrame();
  const flash = interpolate(local, [0, 5], [0.35, 0], { extrapolateRight: "clamp" });

  let visual: React.ReactNode = null;
  if (clip.kind === "master-windows") {
    // Push in toward the upstairs windows of THE house.
    visual = (
      <KenBurns
        src="footage/hero-house-master.png"
        from={{ scale: 1.35, x: 0.5, y: 0.34 }}
        to={{ scale: 2.05, x: 0.5, y: 0.3 }}
        durationInFrames={durationInFrames}
      />
    );
  } else if (clip.kind === "master-finish") {
    // Pull back wide over the striped lawn — the finished home.
    visual = (
      <KenBurns
        src="footage/hero-house-master.png"
        from={{ scale: 1.5, x: 0.5, y: 0.52 }}
        to={{ scale: 1.02, x: 0.5, y: 0.5 }}
        durationInFrames={durationInFrames}
      />
    );
  } else {
    // Pressure-wash service detail — water, stone, garden only; no
    // architecture from any other property is identifiable in this crop.
    // (hour-solar.mp4 was rejected here: its wide framing exposes a
    // different cottage's roofline.)
    const push = interpolate(local, [0, durationInFrames], [1.02, 1.12]);
    visual = (
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <OffthreadVideo
          muted
          src={staticFile("footage/hour-pressure.mp4")}
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transformOrigin: "50% 65%",
            transform: `scale(${push})`,
          }}
        />
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill>
      {visual}
      <AbsoluteFill style={{ background: BRAND.canvas, opacity: flash }} />
      <span
        style={{
          position: "absolute",
          top: "5.2%",
          left: "7%",
          padding: "14px 28px",
          borderRadius: 999,
          background: "rgba(250,246,236,0.85)",
          border: "1px solid rgba(23,63,50,0.14)",
          fontFamily: FONTS.mono,
          fontSize: 27,
          letterSpacing: "0.26em",
          textTransform: "uppercase",
          color: BRAND.pine,
          opacity: interpolate(local, [2, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        {clip.label}
      </span>
    </AbsoluteFill>
  );
};
