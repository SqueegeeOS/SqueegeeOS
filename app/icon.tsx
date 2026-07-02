import { ImageResponse } from "next/og";
import { pwaConfig } from "@/lib/pwa/config";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 8,
          border: "1px solid rgba(201, 184, 150, 0.25)",
        }}
      >
        <div style={{ color: "#c9b896", fontSize: 20, fontWeight: 300 }}>S</div>
      </div>
    ),
    { ...size },
  );
}
