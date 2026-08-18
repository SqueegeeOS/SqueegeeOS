import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND } from "../brand";
import { FONTS } from "../fonts";
import { PhoneFrame } from "../components/PhoneFrame";
import { NextVisitScreen } from "../screens/NextVisit";
import { VisitHistoryScreen } from "../screens/VisitHistory";
import { PhotoProofScreen } from "../screens/PhotoProof";
import { HomeCarePlanScreen } from "../screens/HomeCarePlan";

/**
 * 2.2–7.5s — the HomeAtlas phone interface cycling through
 * Next Visit → Visit History → Photo Proof → Home Care Plan.
 * Caption: “Every visit. Every photo. Every promise.”
 */

const SCREENS = [
  { name: "Next Visit", C: NextVisitScreen },
  { name: "Visit History", C: VisitHistoryScreen },
  { name: "Photo Proof", C: PhotoProofScreen },
  { name: "Home Care Plan", C: HomeCarePlanScreen },
] as const;

const INTRO = 8;
const SLOT = 37;
const XFADE = 8;

export const Act2Portal: React.FC<{ caption: string }> = ({ caption }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const compact = height < 1500;

  // Big phone: it may run beneath the caption gradient — presence over
  // completeness, so in-app type stays readable on a handset.
  const screenW = compact ? width * 0.52 : width * 0.62;
  const u = screenW / 348;

  const phoneIn = interpolate(frame, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const breathe = interpolate(frame, [0, 160], [1, 1.015]);

  return (
    <AbsoluteFill style={{ background: BRAND.portalBg }}>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 90% 50% at 50% -10%, rgba(201,184,150,0.13), transparent 60%), radial-gradient(ellipse 55% 38% at 50% 112%, rgba(201,184,150,0.07), transparent 55%)",
        }}
      />

      {/* screen name label */}
      <div
        style={{
          position: "absolute",
          top: compact ? height * 0.048 : height * 0.062,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: phoneIn,
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: FONTS.mono,
            fontSize: compact ? 18 : 21,
            letterSpacing: "0.34em",
            textTransform: "uppercase",
            color: BRAND.champagne,
            opacity: 0.85,
          }}
        >
          HomeAtlas · included with membership
        </p>
        <div style={{ position: "relative", height: compact ? 52 : 62, marginTop: compact ? 10 : 16 }}>
          {SCREENS.map((s, i) => {
            const start = INTRO + i * SLOT;
            const end = i === SCREENS.length - 1 ? 9999 : start + SLOT + XFADE;
            const o =
              interpolate(frame, [start, start + XFADE], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) *
              interpolate(frame, [end - XFADE, end], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return (
              <p
                key={s.name}
                style={{
                  position: "absolute",
                  inset: 0,
                  margin: 0,
                  fontFamily: FONTS.serif,
                  fontWeight: 400,
                  fontSize: compact ? 40 : 48,
                  color: BRAND.portalFg,
                  opacity: o,
                }}
              >
                {s.name}
              </p>
            );
          })}
        </div>
      </div>

      {/* phone */}
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "flex-start",
          paddingTop: compact ? height * 0.155 : height * 0.16,
          opacity: phoneIn,
          transform: `translateY(${(1 - phoneIn) * 40}px) scale(${breathe})`,
        }}
      >
        <PhoneFrame width={screenW}>
          {SCREENS.map((s, i) => {
            const start = INTRO + i * SLOT;
            const dur = i === SCREENS.length - 1 ? 9999 : SLOT + XFADE;
            return (
              <Sequence key={s.name} from={start} durationInFrames={dur} layout="none">
                <ScreenFader index={i} u={u} C={s.C} isLast={i === SCREENS.length - 1} />
              </Sequence>
            );
          })}
        </PhoneFrame>
      </AbsoluteFill>

      {/* caption floor — fades the phone's lower body out beneath it */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: height * 0.24,
          background: `linear-gradient(to top, ${BRAND.portalBg} 34%, rgba(7,6,5,0.86) 62%, rgba(7,6,5,0) 100%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: compact ? height * 0.035 : height * 0.052,
          textAlign: "center",
          padding: `0 ${width * 0.08}px`,
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: FONTS.serif,
            fontWeight: 400,
            fontSize: compact ? 42 : 50,
            lineHeight: 1.2,
            color: BRAND.portalFg,
            opacity: interpolate(frame, [10, 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          {caption}
        </p>
      </div>
    </AbsoluteFill>
  );
};

const ScreenFader: React.FC<{
  index: number;
  u: number;
  isLast: boolean;
  C: React.FC<{ u: number; frame: number }>;
}> = ({ u, C, isLast }) => {
  const local = useCurrentFrame();
  const inO = interpolate(local, [0, XFADE], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const outO = isLast
    ? 1
    : interpolate(local, [SLOT, SLOT + XFADE], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: inO * outO,
        transform: `translateY(${(1 - inO) * 14}px)`,
      }}
    >
      <C u={u} frame={local} />
    </div>
  );
};
