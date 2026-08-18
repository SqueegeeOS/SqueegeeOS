import React from "react";
import { BRAND, SAMPLE } from "../brand";
import { FONTS } from "../fonts";
import { CheckIcon, Eyebrow, GlassCard, ScreenShell, rise } from "./ui";

export const VisitHistoryScreen: React.FC<{ u: number; frame: number }> = ({ u, frame }) => (
  <ScreenShell u={u} frame={frame}>
    <div style={rise(frame, 2)}>
      <Eyebrow u={u}>Visit History</Eyebrow>
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 10 * u, marginTop: 12 * u }}>
      {SAMPLE.history.map((h, i) => (
        <GlassCard
          key={h.date}
          u={u}
          style={{
            padding: `${14 * u}px ${16 * u}px`,
            display: "flex",
            alignItems: "center",
            gap: 14 * u,
            ...rise(frame, 5 + i * 4),
          }}
        >
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 10.5 * u,
              letterSpacing: "0.08em",
              color: BRAND.champagne,
              width: 52 * u,
              flexShrink: 0,
            }}
          >
            {h.date}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontFamily: FONTS.sans, fontSize: 13.5 * u, fontWeight: 500, color: BRAND.portalFg }}>
              {h.service}
            </span>
            <span style={{ display: "block", marginTop: 3 * u, fontFamily: FONTS.sans, fontSize: 11 * u, color: BRAND.portalMuted }}>
              {h.photos} · Documented
            </span>
          </span>
          <CheckIcon size={20 * u} />
        </GlassCard>
      ))}
    </div>
    <p
      style={{
        margin: `${16 * u}px 0 0`,
        textAlign: "center",
        fontFamily: FONTS.serif,
        fontStyle: "italic",
        fontSize: 13.5 * u,
        color: "rgba(245,242,235,0.55)",
        ...rise(frame, 18),
      }}
    >
      Every visit on record, since day one.
    </p>
  </ScreenShell>
);
