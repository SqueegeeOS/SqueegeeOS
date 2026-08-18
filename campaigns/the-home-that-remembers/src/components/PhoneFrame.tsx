import React from "react";
import { BRAND } from "../brand";

/**
 * Deterministic phone shell — pure DOM/SVG, no imagery.
 * Screen aspect is ~19.5:9 (modern flagship). Children fill the screen.
 */
export const PhoneFrame: React.FC<{
  width: number;
  children: React.ReactNode;
}> = ({ width, children }) => {
  const screenW = width;
  const screenH = Math.round(width * 2.09);
  const bezel = Math.round(width * 0.028);
  const radius = Math.round(width * 0.155);

  return (
    <div
      style={{
        width: screenW + bezel * 2,
        height: screenH + bezel * 2,
        borderRadius: radius + bezel,
        background: "linear-gradient(160deg, #2b2823 0%, #16140f 45%, #211e19 100%)",
        boxShadow:
          "0 60px 140px -40px rgba(0,0,0,0.75), 0 24px 60px -30px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,248,235,0.18), inset 0 -1px 0 rgba(0,0,0,0.6)",
        padding: bezel,
        position: "relative",
      }}
    >
      <div
        style={{
          width: screenW,
          height: screenH,
          borderRadius: radius,
          background: BRAND.portalBg,
          overflow: "hidden",
          position: "relative",
          border: "1px solid rgba(0,0,0,0.85)",
        }}
      >
        {/* status bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: screenW * 0.115,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: `0 ${screenW * 0.085}px`,
            zIndex: 30,
          }}
        >
          <span
            style={{
              color: BRAND.portalFg,
              opacity: 0.9,
              fontSize: screenW * 0.038,
              fontWeight: 600,
              letterSpacing: "0.02em",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            9:41
          </span>
          <svg width={screenW * 0.16} height={screenW * 0.04} viewBox="0 0 64 16" fill="none">
            {/* signal */}
            <rect x="0" y="9" width="3" height="6" rx="1" fill={BRAND.portalFg} opacity="0.9" />
            <rect x="5" y="6.5" width="3" height="8.5" rx="1" fill={BRAND.portalFg} opacity="0.9" />
            <rect x="10" y="4" width="3" height="11" rx="1" fill={BRAND.portalFg} opacity="0.9" />
            <rect x="15" y="1.5" width="3" height="13.5" rx="1" fill={BRAND.portalFg} opacity="0.45" />
            {/* wifi */}
            <path d="M28 6.5c3.6-3.4 9.4-3.4 13 0l-1.9 2c-2.6-2.4-6.6-2.4-9.2 0l-1.9-2Z" fill={BRAND.portalFg} opacity="0.9" />
            <path d="M31 9.8c1.9-1.8 5.1-1.8 7 0l-1.9 2a2.6 2.6 0 0 0-3.2 0l-1.9-2Z" fill={BRAND.portalFg} opacity="0.9" />
            <circle cx="34.5" cy="13.6" r="1.6" fill={BRAND.portalFg} opacity="0.9" />
            {/* battery */}
            <rect x="46" y="3" width="14" height="10" rx="3" stroke={BRAND.portalFg} strokeOpacity="0.5" />
            <rect x="48" y="5" width="8.5" height="6" rx="1.5" fill={BRAND.portalFg} opacity="0.9" />
            <rect x="61.5" y="6.2" width="2" height="3.6" rx="1" fill={BRAND.portalFg} opacity="0.5" />
          </svg>
        </div>
        {/* island */}
        <div
          style={{
            position: "absolute",
            top: screenW * 0.032,
            left: "50%",
            transform: "translateX(-50%)",
            width: screenW * 0.26,
            height: screenW * 0.072,
            borderRadius: 999,
            background: "#000",
            zIndex: 40,
          }}
        />
        {children}
        {/* home indicator */}
        <div
          style={{
            position: "absolute",
            bottom: screenW * 0.022,
            left: "50%",
            transform: "translateX(-50%)",
            width: screenW * 0.32,
            height: screenW * 0.011,
            borderRadius: 999,
            background: BRAND.portalFg,
            opacity: 0.35,
            zIndex: 30,
          }}
        />
      </div>
    </div>
  );
};
