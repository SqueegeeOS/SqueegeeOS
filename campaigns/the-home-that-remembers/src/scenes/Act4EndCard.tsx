import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND } from "../brand";
import { FONTS } from "../fonts";
import { AtlasMark } from "../components/AtlasMark";

/**
 * 11.8–15.0s — brand close.
 * “Window cleaning with a memory.” / CTA / SqueegeeKing.net
 */
export const Act4EndCard: React.FC<{
  headline: string;
  headlineAccent: string;
  cta: string;
  url: string;
}> = ({ headline, headlineAccent, cta, url }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const compact = height < 1500;

  const enter = (start: number, dur = 12) =>
    interpolate(frame, [start, start + dur], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  const riseStyle = (start: number): React.CSSProperties => ({
    opacity: enter(start),
    transform: `translateY(${(1 - enter(start)) * 22}px)`,
  });

  return (
    <AbsoluteFill style={{ background: BRAND.pineDeep }}>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 85% 60% at 50% -8%, rgba(201,184,150,0.16), transparent 60%), radial-gradient(ellipse 70% 45% at 50% 115%, rgba(23,63,50,0.9), transparent 70%), linear-gradient(180deg, #14382c 0%, #0f2c22 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          padding: `0 ${width * 0.08}px`,
          textAlign: "center",
          gap: 0,
        }}
      >
        <div style={{ opacity: enter(0) }}>
          <AtlasMark
            size={compact ? 120 : 150}
            frame={frame}
            color={BRAND.warmWhite}
            accent={BRAND.champagne}
            drawStart={2}
          />
        </div>

        <p
          style={{
            margin: `${compact ? 20 : 30}px 0 0`,
            fontFamily: FONTS.serif,
            fontWeight: 300,
            fontSize: compact ? 74 : 86,
            letterSpacing: "-0.01em",
            color: BRAND.warmWhite,
            lineHeight: 1,
            ...riseStyle(6),
          }}
        >
          SqueegeeKing
        </p>
        <p
          style={{
            margin: `${compact ? 12 : 16}px 0 0`,
            fontFamily: FONTS.mono,
            fontSize: compact ? 22 : 25,
            letterSpacing: "0.44em",
            textTransform: "uppercase",
            color: BRAND.champagne,
            ...riseStyle(10),
          }}
        >
          with HomeAtlas
        </p>

        <p
          style={{
            margin: `${compact ? 34 : 48}px 0 0`,
            fontFamily: FONTS.serif,
            fontWeight: 400,
            fontSize: compact ? 48 : 56,
            lineHeight: 1.14,
            color: BRAND.warmWhite,
            maxWidth: width * 0.84,
            textWrap: "balance" as never,
            ...riseStyle(16),
          }}
        >
          {headline}{" "}
          <em style={{ fontFamily: FONTS.serifItalic, fontStyle: "italic", color: BRAND.champagne }}>
            {headlineAccent}
          </em>
        </p>

        <div style={{ ...riseStyle(24), marginTop: compact ? 30 : 44 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 18,
              borderRadius: 999,
              background: BRAND.canvas,
              padding: compact ? "22px 44px" : "26px 54px",
              boxShadow: "0 30px 80px -30px rgba(0,0,0,0.55)",
            }}
          >
            <span
              style={{
                fontFamily: FONTS.sans,
                fontWeight: 600,
                fontSize: compact ? 30 : 34,
                letterSpacing: "0.01em",
                color: BRAND.pine,
              }}
            >
              {cta}
            </span>
            <span aria-hidden style={{ fontFamily: FONTS.mono, fontSize: compact ? 28 : 32, color: BRAND.bronzeText }}>
              →
            </span>
          </div>
        </div>

        <p
          style={{
            margin: `${compact ? 22 : 30}px 0 0`,
            fontFamily: FONTS.mono,
            fontSize: compact ? 24 : 27,
            letterSpacing: "0.22em",
            color: "rgba(245,242,235,0.82)",
            ...riseStyle(32),
          }}
        >
          {url}
        </p>
      </AbsoluteFill>
      {/* film grain */}
      <AbsoluteFill
        style={{
          opacity: 0.045,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")",
          backgroundSize: "180px 180px",
        }}
      />
    </AbsoluteFill>
  );
};
