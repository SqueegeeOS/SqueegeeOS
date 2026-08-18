import React from "react";
import { BRAND, SAMPLE } from "../brand";
import { FONTS } from "../fonts";
import { AtlasMark } from "../components/AtlasMark";
import { Eyebrow, GlassCard, ScreenShell, rise } from "./ui";

/** Mirrors components/portal/next-care-visit-hero.tsx with sample data. */
export const NextVisitScreen: React.FC<{ u: number; frame: number }> = ({ u, frame }) => {
  const v = SAMPLE.nextVisit;
  return (
    <ScreenShell u={u} frame={frame}>
      <GlassCard u={u} style={{ padding: 20 * u, ...rise(frame, 4) }}>
        <div style={{ display: "flex", gap: 16 * u }}>
          {/* date accent tile */}
          <div
            style={{
              width: 70 * u,
              height: 80 * u,
              flexShrink: 0,
              borderRadius: 17 * u,
              border: "1px solid rgba(201,184,150,0.25)",
              background: "rgba(201,184,150,0.07)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2 * u,
            }}
          >
            <AtlasMark size={20 * u} frame={frame} color="rgba(201,184,150,0.75)" accent={BRAND.champagne} drawStart={-60} />
            <span style={{ fontFamily: FONTS.mono, fontSize: 8.5 * u, letterSpacing: "0.22em", color: BRAND.champagne }}>
              {v.month}
            </span>
            <span style={{ fontFamily: FONTS.serif, fontSize: 26 * u, lineHeight: 1, color: BRAND.portalFg }}>
              {v.day}
            </span>
          </div>
          <div style={{ minWidth: 0, flex: 1, paddingTop: 2 * u }}>
            <Eyebrow u={u}>Next Care Visit</Eyebrow>
            <p
              style={{
                margin: `${8 * u}px 0 0`,
                fontFamily: FONTS.serif,
                fontSize: 28 * u,
                lineHeight: 1.05,
                letterSpacing: "-0.01em",
                color: BRAND.portalFg,
              }}
            >
              {v.dateLong}
            </p>
            <p style={{ margin: `${9 * u}px 0 0`, fontFamily: FONTS.sans, fontSize: 13 * u, lineHeight: 1.35, color: "rgba(245,242,235,0.78)" }}>
              {v.service}
            </p>
            <p style={{ margin: `${7 * u}px 0 0`, display: "flex", alignItems: "center", gap: 8 * u, fontFamily: FONTS.sans, fontSize: 12.5 * u, color: BRAND.portalMuted }}>
              <span style={{ width: 16 * u, height: 1, background: "rgba(201,184,150,0.35)" }} />
              {v.window}
            </p>
            <p style={{ margin: `${13 * u}px 0 0`, fontFamily: FONTS.sans, fontSize: 12.5 * u, lineHeight: 1.5, color: "rgba(245,242,235,0.52)" }}>
              {v.support}
            </p>
          </div>
        </div>
        <p
          style={{
            margin: `${16 * u}px 0 0`,
            paddingTop: 14 * u,
            borderTop: "1px solid rgba(255,248,235,0.08)",
            fontFamily: FONTS.sans,
            fontSize: 11.5 * u,
            lineHeight: 1.5,
            color: "rgba(245,242,235,0.45)",
          }}
        >
          {v.reassurance}
        </p>
      </GlassCard>
    </ScreenShell>
  );
};
