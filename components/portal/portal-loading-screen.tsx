import Image from "next/image";
import type { CSSProperties } from "react";
import { AtlasMark } from "@/components/theme/atlas-mark";

const ARTWORK_PATH = "/brand/homeatlas-member-loader-v3.webp";
const ARTWORK_PREVIEW_DATA_URL =
  "data:image/webp;base64,UklGRr4EAABXRUJQVlA4ILIEAAAwGQCdASpAAHIAPqFEnUmmI6KhKhZsWMAUCWUcAA56p7a6otj1tGb3jTno/ac3LUXAKHjyUuBN4uHJ3MaeNHLjDNQbq6lSLKULAw4xJFUpYybZWrG4hst8/UKMBvc7xHi8Gbi0d0zFKVpHHu1QG18dZ0hAqcIRAsTfzpI+R8OwQg46S3uS4Okwtzsv2Sqz5P1vW/cvevNmVxl+pep/kAl4VYXncJenveeNBv/N7EEJ8bx3/Eo+rTCqSQclYd4NweYk6EpXVRVHA+BKHrR4cctFiwAA/v3buXFnInn8EiFda9xe23WDhTqjix9nD1bN/s46PmvAvUbezzMSfmpZq4c85Lr4UFfT1Am93+2xqyN5wU5HhY99vdyBlMtbrEPvULOp/lOROSJ/dNqdheCF1pbUu4yKV3wIRafA0mdBQbZCOPEM25SXVuq8+0OXTa1vEy9Jq+Sk7ZjbDcjPK6x1kQTVoSu6n+LQtohjKx0XNO4mI+20hgZbhP01p6kt6lp1Dzzp63O9j5NMDJGiyRouZFzUf6ab4YautG/mh7Fc9bGJSu4O4uV9X3O589t/X1ikGVrBQnzjPrmz5kLkcjbF7yA3R1r5ubv48MdGMGc3rOrvVow6NIA54hzTZuP8HCq34TNmhnGvOCWP6NNWnKY+lomOtICZUPCfJDL3NkH12wuelhcQKzzOUYd6hEx4jMsQiVZuUIroG8fNSuQLuRE1cUD8uGP0cDIJRy5gF4IPiBpXwTK4k/aU790T4bsr+rN5olZ0ZjcIg7NpEl50Rvt/JKE6OdqcTgcqmSTnbxnYZ6t6NLasF0kG23R1TR/jZLZN7XxWe8AWvukEUIr/kw9zvxJhV30Fur0ItLjSdb6upJ1SLyHelZcVG21JNL04RAndCjIfsrLXDn1fOqQtgJ4bSk4f4vI2sS0Lfo+q7zP9SjEUumzNvfl+DYmWlOE7ozK7GKbDIXCX2QGlDhHEm4vXKn0nim0kFrFzMOLTsOh+sa4BViY4CL4Va5Lz93wQmkuzp8yjNz6lUwni6CC+rNGJsBrtusONNMJYdM3+injdsQEDKiT8iYnvCHLMxF9fQaCTKokjoI605MpFsZrU5cjPnv6pMe9KufCFnCNdKg1jopYePndD79GE4ql2LNHK5gGIsQ/OZbwvPG+gcY7n+u023LX/wvXXGcj5Jsi+w8yEEJmZ4q8Mj+oKTpLKErCF1jlwXmNNJYUF3DQ/SCkmqtNytKm0r/J1HALp4u43sX3hKRVqK3FXGfdAN5y0do7AmN1RWo/KYbHSO8+ojgQ188UfMtnT6O28nvaqaQKCX/1Ge1dE25FHZcvbr5SoP1OYWz2L8ZVKGntyQClEGCa7HLAHPTbQy3m3O9gjvoQmo18LOTtJjBmHmP6HoO4ds+XBv8MOGQasdwEagWTcvKtI/vMen2IXmKPcIjAiqbzuIDQx7F5zy00wF2YJZCUcdAPK3hYIss3YXZl0GFEsoTWnP4iyDbV1VhGwqfHFeEkFht7Ds4iSZu+8HMDeDYJrdoO2RQIO49apOkYPpSBAtdpP7ZQj22skFy+gIpLaRVfWqgcdjdIyw0pUUlhtWqcRI7gapArtfigAAA==";

const previewStyle = {
  "--portal-loader-preview": `url("${ARTWORK_PREVIEW_DATA_URL}")`,
  backgroundColor: "#0b0d0a",
  backgroundImage: "var(--portal-loader-preview)",
  backgroundPosition: "center",
  backgroundSize: "cover",
} as CSSProperties;

export function PortalLoadingScreen() {
  return (
    <main
      className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-[#050605] text-[#f4eddf]"
      role="status"
      aria-live="polite"
      aria-label="Preparing your HomeAtlas portal"
      style={previewStyle}
    >
      <div
        className="absolute inset-0 scale-110 bg-cover bg-center opacity-40 blur-2xl"
        style={{ backgroundImage: "var(--portal-loader-preview)" }}
        aria-hidden="true"
      />

      <div
        className="relative h-[100svh] max-h-[177.7vw] w-[56.28svh] max-w-full overflow-hidden bg-cover bg-center shadow-[0_0_100px_rgba(0,0,0,0.72)]"
        style={{ backgroundImage: "var(--portal-loader-preview)" }}
      >
        <Image
          src={ARTWORK_PATH}
          alt=""
          fill
          unoptimized
          loading="eager"
          fetchPriority="high"
          sizes="(max-aspect-ratio:941/1672) 100vw, 56.28svh"
          className="object-contain"
          aria-hidden
        />

        <div
          className="portal-loading-atlas absolute left-1/2 top-[46.9%] flex aspect-square w-[24%] -translate-x-1/2 -translate-y-1/2 items-center justify-center [--accent:#e4b94f] [--foreground:#f4eddf]"
          aria-hidden
        >
          <AtlasMark
            size={180}
            className="h-full w-full text-[#f4eddf] drop-shadow-[0_4px_18px_rgba(0,0,0,0.72)]"
          />
        </div>

        <div className="absolute inset-0" aria-hidden>
          {[22.9, 50, 76.9].map((left, index) => {
            return (
              <span
                key={left}
                className="portal-loading-dot portal-loading-dot-sequence absolute top-[88.37%] aspect-square w-[3.55%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#e0b646]"
                style={{
                  left: `${left}%`,
                  animationDelay: `${index}s`,
                }}
              />
            );
          })}
        </div>
      </div>

      <span className="sr-only">
        Opening your property timeline, next visit, and home care plan.
      </span>
    </main>
  );
}
