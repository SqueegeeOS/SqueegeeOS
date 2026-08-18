import React from "react";
import { AbsoluteFill, Img, staticFile, useVideoConfig } from "remotion";
import { BRAND } from "./brand";
import { FONTS } from "./fonts";
import { AtlasMark } from "./components/AtlasMark";

/** Static poster — same brand system as the end card over the hero exterior. */
export type PosterProps = Record<string, unknown> & {
  headline: string;
  headlineAccent: string;
  cta: string;
  url: string;
  imageSrc: string;
};

export const Poster: React.FC<PosterProps> = ({ headline, headlineAccent, cta, url, imageSrc }) => {
  const { width, height } = useVideoConfig();
  const compact = height < 1500;

  return (
    <AbsoluteFill style={{ background: BRAND.canvas }}>
      <Img src={staticFile(imageSrc)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to top, rgba(250,246,236,0.99) 0%, rgba(250,246,236,0.95) 22%, rgba(250,246,236,0.45) 48%, rgba(250,246,236,0.05) 70%)",
        }}
      />
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", textAlign: "center", padding: `0 ${width * 0.07}px ${height * 0.045}px` }}>
        <AtlasMark size={compact ? 92 : 110} frame={1000} color={BRAND.pine} accent={BRAND.bronze} drawStart={-1000} />
        <p style={{ margin: `${compact ? 14 : 20}px 0 0`, fontFamily: FONTS.serif, fontWeight: 300, fontSize: compact ? 60 : 68, color: BRAND.pine, lineHeight: 1 }}>
          SqueegeeKing
        </p>
        <p style={{ margin: `${compact ? 8 : 12}px 0 0`, fontFamily: FONTS.mono, fontSize: compact ? 17 : 19, letterSpacing: "0.44em", textTransform: "uppercase", color: BRAND.bronzeText }}>
          with HomeAtlas
        </p>
        <p
          style={{
            margin: `${compact ? 26 : 38}px 0 0`,
            fontFamily: FONTS.serif,
            fontWeight: 400,
            fontSize: compact ? 54 : 64,
            lineHeight: 1.1,
            color: BRAND.pine,
            maxWidth: width * 0.88,
            textWrap: "balance" as never,
          }}
        >
          {headline}{" "}
          <em style={{ fontFamily: FONTS.serifItalic, fontStyle: "italic", color: BRAND.bronzeText }}>{headlineAccent}</em>
        </p>
        <div
          style={{
            marginTop: compact ? 26 : 38,
            display: "inline-flex",
            alignItems: "center",
            gap: 16,
            borderRadius: 999,
            background: BRAND.pine,
            padding: compact ? "20px 42px" : "24px 50px",
            boxShadow: "0 30px 80px -34px rgba(23,63,50,0.7)",
          }}
        >
          <span style={{ fontFamily: FONTS.sans, fontWeight: 600, fontSize: compact ? 28 : 32, color: BRAND.warmWhite }}>
            {cta}
          </span>
          <span aria-hidden style={{ fontFamily: FONTS.mono, fontSize: compact ? 26 : 30, color: BRAND.champagne }}>→</span>
        </div>
        <p style={{ margin: `${compact ? 18 : 24}px 0 0`, fontFamily: FONTS.mono, fontSize: compact ? 21 : 24, letterSpacing: "0.22em", color: BRAND.pine }}>
          {url}
        </p>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
