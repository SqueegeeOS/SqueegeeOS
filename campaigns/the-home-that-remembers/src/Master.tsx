import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { Act1Opening } from "./scenes/Act1Opening";
import { Act2Portal } from "./scenes/Act2Portal";
import { Act3Montage, type MontageClip } from "./scenes/Act3Montage";
import { Act4EndCard } from "./scenes/Act4EndCard";

export type MasterProps = Record<string, unknown> & {
  hook: string;
  hookAccent: string;
  portalCaption: string;
  montageCaption: string;
  headline: string;
  headlineAccent: string;
  cta: string;
  url: string;
  heroSrc: string;
  heroIsVertical: boolean;
  montageClips: MontageClip[];
};

/**
 * 15.0s master timeline @ 30fps (450 frames):
 *   Act 1  0–66     warm exterior + hook
 *   Act 2  66–225   HomeAtlas phone interface
 *   Act 3  225–354  service montage
 *   Act 4  354–450  brand end card
 * All copy arrives via props so hook/CTA variants are one prop change.
 */
export const Master: React.FC<MasterProps> = (p) => {
  const frame = useCurrentFrame();
  // Soft dip-to-dark into the end card.
  const dip = interpolate(frame, [348, 354], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: "#0f2c22" }}>
      <Sequence durationInFrames={66}>
        <Act1Opening
          hook={p.hook}
          hookAccent={p.hookAccent}
          heroSrc={p.heroSrc}
          heroIsVertical={p.heroIsVertical}
        />
      </Sequence>
      <Sequence from={66} durationInFrames={159}>
        <Act2Portal caption={p.portalCaption} />
      </Sequence>
      <Sequence from={225} durationInFrames={129}>
        <AbsoluteFill style={{ opacity: 1 - dip }}>
          <Act3Montage caption={p.montageCaption} clips={p.montageClips} />
        </AbsoluteFill>
      </Sequence>
      <Sequence from={354} durationInFrames={96}>
        <Act4EndCard headline={p.headline} headlineAccent={p.headlineAccent} cta={p.cta} url={p.url} />
      </Sequence>
    </AbsoluteFill>
  );
};

export const DEFAULT_PROPS: MasterProps = {
  hook: "Your home shouldn’t have to explain itself",
  hookAccent: "twice.",
  portalCaption: "Every visit. Every photo. Every promise.",
  montageCaption: "Professional home care—remembered.",
  headline: "Window cleaning with a",
  headlineAccent: "memory.",
  cta: "Get your free Home Care Plan",
  url: "SqueegeeKing.net",
  heroSrc: "footage/hero-vertical.mp4",
  heroIsVertical: true,
  // HOUSE CONTINUITY: architecture only ever comes from
  // hero-house-master.png / hero-vertical.mp4 (the same house).
  // hour-window.mp4 (squeegee close-up) and clips showing other properties
  // (hour-dusk, hero-film full shots) are excluded on purpose.
  montageClips: [
    { kind: "master-windows", label: "Windows" },
    { kind: "pressure-detail", label: "Pressure wash" },
    { kind: "master-finish", label: "The finish" },
  ],
};
