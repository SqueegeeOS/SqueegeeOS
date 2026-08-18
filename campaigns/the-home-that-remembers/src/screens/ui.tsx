import React from "react";
import { interpolate } from "remotion";
import { BRAND, SAMPLE } from "../brand";
import { FONTS } from "../fonts";
import { AtlasMark } from "../components/AtlasMark";

/** Shared portal primitives — mirrors the app's craft-glass recipes (app/globals.css). */

export const GlassCard: React.FC<{
  u: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ u, style, children }) => (
  <div
    style={{
      border: `1px solid ${BRAND.glassBorder}`,
      background:
        "linear-gradient(165deg, rgba(255,248,235,0.06) 0%, transparent 42%), linear-gradient(180deg, rgba(255,248,235,0.035) 0%, rgba(12,11,10,0.55) 100%)",
      borderRadius: 22 * u,
      boxShadow: "0 2px 4px rgba(0,0,0,0.14), 0 18px 52px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,248,235,0.05)",
      ...style,
    }}
  >
    {children}
  </div>
);

export const Eyebrow: React.FC<{ u: number; children: React.ReactNode }> = ({ u, children }) => (
  <p
    style={{
      margin: 0,
      fontFamily: FONTS.mono,
      fontSize: 10 * u,
      fontWeight: 500,
      letterSpacing: "0.32em",
      textTransform: "uppercase",
      color: BRAND.champagne,
      opacity: 0.9,
    }}
  >
    {children}
  </p>
);

/** Fade-and-rise entrance, like the app's hq-card-reveal. */
export const rise = (frame: number, start: number, dist = 14): React.CSSProperties => {
  const t = interpolate(frame, [start, start + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { opacity: t, transform: `translateY(${(1 - t) * dist}px)` };
};

export const PortalHeader: React.FC<{ u: number; frame: number }> = ({ u, frame }) => (
  <div style={{ paddingTop: 64 * u, textAlign: "center", ...rise(frame, 0) }}>
    <div style={{ display: "flex", justifyContent: "center" }}>
      <AtlasMark size={34 * u} frame={frame} color={BRAND.portalFg} accent={BRAND.champagne} drawStart={-60} />
    </div>
    <p
      style={{
        margin: `${8 * u}px 0 0`,
        fontFamily: FONTS.mono,
        fontSize: 9 * u,
        letterSpacing: "0.42em",
        textTransform: "uppercase",
        color: BRAND.champagne,
      }}
    >
      HomeAtlas
    </p>
    <p
      style={{
        margin: `${10 * u}px 0 0`,
        fontFamily: FONTS.serif,
        fontWeight: 500,
        fontSize: 22 * u,
        color: BRAND.portalFg,
        letterSpacing: "-0.01em",
      }}
    >
      {SAMPLE.property}
    </p>
    <p
      style={{
        margin: `${4 * u}px 0 0`,
        fontFamily: FONTS.sans,
        fontSize: 11 * u,
        color: BRAND.portalMuted,
      }}
    >
      {SAMPLE.locality} · {SAMPLE.memberSince}
    </p>
  </div>
);

export const ScreenShell: React.FC<{
  u: number;
  frame: number;
  children: React.ReactNode;
}> = ({ u, frame, children }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      background:
        "radial-gradient(ellipse 90% 55% at 50% -14%, rgba(201,184,150,0.09), transparent 62%)",
    }}
  >
    <PortalHeader u={u} frame={frame} />
    <div style={{ padding: `${18 * u}px ${20 * u}px 0` }}>{children}</div>
  </div>
);

export const CheckIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="10" r="9" stroke={BRAND.champagne} strokeOpacity="0.4" />
    <path d="M6 10.2 L8.8 13 L14 7.6" stroke={BRAND.champagne} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
