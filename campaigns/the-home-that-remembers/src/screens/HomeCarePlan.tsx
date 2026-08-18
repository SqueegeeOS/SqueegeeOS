import React from "react";
import { BRAND, SAMPLE } from "../brand";
import { FONTS } from "../fonts";
import { CheckIcon, Eyebrow, GlassCard, ScreenShell, rise } from "./ui";

export const HomeCarePlanScreen: React.FC<{ u: number; frame: number }> = ({ u, frame }) => (
  <ScreenShell u={u} frame={frame}>
    <div style={rise(frame, 2)}>
      <Eyebrow u={u}>Home Care Plan</Eyebrow>
    </div>
    <GlassCard u={u} style={{ marginTop: 12 * u, padding: `${6 * u}px ${18 * u}px`, ...rise(frame, 5) }}>
      {SAMPLE.plan.map((p, i) => (
        <div
          key={p.service}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12 * u,
            padding: `${14 * u}px 0`,
            borderTop: i === 0 ? "none" : "1px solid rgba(255,248,235,0.07)",
            ...rise(frame, 7 + i * 4),
          }}
        >
          <span style={{ fontFamily: FONTS.sans, fontSize: 13.5 * u, fontWeight: 500, color: BRAND.portalFg }}>
            {p.service}
          </span>
          <span style={{ fontFamily: FONTS.mono, fontSize: 10 * u, letterSpacing: "0.12em", textTransform: "uppercase", color: BRAND.champagne }}>
            {p.cadence}
          </span>
        </div>
      ))}
    </GlassCard>
    <GlassCard
      u={u}
      style={{
        marginTop: 12 * u,
        padding: `${13 * u}px ${16 * u}px`,
        display: "flex",
        alignItems: "center",
        gap: 12 * u,
        border: "1px solid rgba(201,184,150,0.28)",
        ...rise(frame, 18),
      }}
    >
      <CheckIcon size={20 * u} />
      <span style={{ fontFamily: FONTS.sans, fontSize: 12.5 * u, color: BRAND.portalFg }}>
        {SAMPLE.guarantee}
      </span>
    </GlassCard>
    <p
      style={{
        margin: `${16 * u}px 0 0`,
        textAlign: "center",
        fontFamily: FONTS.serif,
        fontStyle: "italic",
        fontSize: 13.5 * u,
        color: "rgba(245,242,235,0.55)",
        ...rise(frame, 22),
      }}
    >
      Your plan, remembered for you.
    </p>
  </ScreenShell>
);
