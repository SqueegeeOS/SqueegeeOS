import { ImageResponse } from "next/og";
import { pwaConfig } from "@/lib/pwa/config";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: pwaConfig.backgroundColor,
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            color: "#c9b896",
            fontSize: 96,
            fontWeight: 300,
            fontFamily: "Georgia, serif",
          }}
        >
          S
        </div>
      </div>
    ),
    { ...size },
  );
}
