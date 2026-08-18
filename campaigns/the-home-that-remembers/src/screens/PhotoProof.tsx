import React from "react";
import { Img, staticFile } from "remotion";
import { BRAND, SAMPLE } from "../brand";
import { FONTS } from "../fonts";
import { Eyebrow, ScreenShell, rise } from "./ui";

const Chip: React.FC<{ u: number; children: React.ReactNode }> = ({ u, children }) => (
  <span
    style={{
      position: "absolute",
      left: 10 * u,
      bottom: 10 * u,
      padding: `${4 * u}px ${9 * u}px`,
      borderRadius: 999,
      background: "rgba(7,6,5,0.72)",
      border: "1px solid rgba(255,248,235,0.14)",
      fontFamily: FONTS.mono,
      fontSize: 8.5 * u,
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      color: BRAND.portalFg,
    }}
  >
    {children}
  </span>
);

/** Real service footage stills stand in as visit documentation. */
export const PhotoProofScreen: React.FC<{ u: number; frame: number }> = ({ u, frame }) => {
  const [hero, ...rest] = SAMPLE.photoProof.shots;
  return (
    <ScreenShell u={u} frame={frame}>
      <div style={rise(frame, 2)}>
        <Eyebrow u={u}>Photo Proof</Eyebrow>
      </div>
      <div style={{ position: "relative", marginTop: 12 * u, borderRadius: 18 * u, overflow: "hidden", height: 148 * u, ...rise(frame, 5) }}>
        <Img
          src={staticFile(hero.src)}
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: hero.position, transform: `scale(${hero.zoom})`, transformOrigin: hero.position }}
        />
        <Chip u={u}>{hero.chip}</Chip>
      </div>
      <div style={{ display: "flex", gap: 10 * u, marginTop: 10 * u }}>
        {rest.map((s, i) => (
          <div
            key={s.chip}
            style={{ position: "relative", flex: 1, borderRadius: 16 * u, overflow: "hidden", height: 96 * u, ...rise(frame, 9 + i * 4) }}
          >
            <Img
              src={staticFile(s.src)}
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: s.position, transform: `scale(${s.zoom})`, transformOrigin: s.position }}
            />
            <Chip u={u}>{s.chip}</Chip>
          </div>
        ))}
      </div>
      <p
        style={{
          margin: `${16 * u}px 0 0`,
          textAlign: "center",
          fontFamily: FONTS.sans,
          fontSize: 12 * u,
          color: BRAND.portalMuted,
          ...rise(frame, 16),
        }}
      >
        {SAMPLE.photoProof.note}
      </p>
    </ScreenShell>
  );
};
