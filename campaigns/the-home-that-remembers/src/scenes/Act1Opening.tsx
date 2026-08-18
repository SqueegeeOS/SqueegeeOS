import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND } from "../brand";
import { FONTS } from "../fonts";

/**
 * 0.0–2.2s — warm residential exterior.
 * Headline: “Your home shouldn’t have to explain itself twice.”
 * If a native vertical hero clip exists (Higgsfield 9:16), it plays
 * full-bleed; otherwise the landscape film sits in the brand's arch frame.
 */
export const Act1Opening: React.FC<{
  hook: string;
  hookAccent: string;
  heroSrc: string;
  heroIsVertical: boolean;
  heroPoster?: string;
}> = ({ hook, hookAccent, heroSrc, heroIsVertical, heroPoster }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const compact = height < 1500;

  const enter = (start: number, dur = 10) =>
    interpolate(frame, [start, start + dur], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  const push = interpolate(frame, [0, 70], [1.05, 1.0], {
    extrapolateRight: "clamp",
  });

  const isVideo = heroSrc.endsWith(".mp4");
  const media = isVideo ? (
    <OffthreadVideo muted src={staticFile(heroSrc)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
  ) : (
    <Img src={staticFile(heroSrc)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
  );

  const headlineSize = compact ? width * 0.072 : width * 0.078;

  const headline = (color: string, accentColor: string) => (
    <>
      <p
        style={{
          margin: 0,
          fontFamily: FONTS.mono,
          fontSize: compact ? 19 : 22,
          letterSpacing: "0.3em",
          textTransform: "uppercase",
          color,
          opacity: 0.72 * enter(2),
        }}
      >
        SqueegeeKing · Chico, California
      </p>
      <h1
        style={{
          margin: `${compact ? 18 : 26}px 0 0`,
          fontFamily: FONTS.serif,
          fontWeight: 300,
          fontSize: headlineSize,
          lineHeight: 1.04,
          letterSpacing: "-0.015em",
          color,
          opacity: enter(5),
          transform: `translateY(${(1 - enter(5)) * 26}px)`,
          textWrap: "balance" as never,
        }}
      >
        {hook}{" "}
        <em style={{ fontFamily: FONTS.serifItalic, fontStyle: "italic", color: accentColor }}>{hookAccent}</em>
      </h1>
    </>
  );

  if (heroIsVertical) {
    // Full-bleed vertical footage with a warm cream floor for the headline.
    return (
      <AbsoluteFill style={{ background: BRAND.canvas }}>
        <AbsoluteFill style={{ transform: `scale(${push})` }}>{media}</AbsoluteFill>
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(to top, rgba(250,246,236,0.98) 0%, rgba(250,246,236,0.9) 16%, rgba(250,246,236,0.4) 34%, rgba(250,246,236,0) 52%)",
          }}
        />
        <AbsoluteFill style={{ justifyContent: "flex-end", padding: `0 ${width * 0.075}px ${height * 0.055}px` }}>
          <div>{headline(BRAND.pine, BRAND.bronzeText)}</div>
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  // Editorial arch layout for landscape source footage — no ugly crop.
  const archW = width * 0.84;
  const archH = height * (compact ? 0.52 : 0.56);
  return (
    <AbsoluteFill style={{ background: BRAND.canvas }}>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 90% 55% at 50% -10%, rgba(214,197,161,0.35), transparent 62%), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(187,205,174,0.28), transparent 55%)",
        }}
      />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: height * 0.06 }}>
        <div
          style={{
            width: archW,
            height: archH,
            borderRadius: `${archW / 2}px ${archW / 2}px 24px 24px`,
            overflow: "hidden",
            boxShadow: "0 60px 140px -60px rgba(23,63,50,0.55)",
            border: "1px solid rgba(23,63,50,0.12)",
            opacity: enter(0, 8),
            transform: `scale(${push})`,
          }}
        >
          {media}
          {heroPoster ? null : null}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "flex-end", padding: `0 ${width * 0.075}px ${height * 0.06}px` }}>
        <div>{headline(BRAND.pine, BRAND.bronzeText)}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
