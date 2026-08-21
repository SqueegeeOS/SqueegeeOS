import Image from "next/image";
import { AtlasMark } from "@/components/theme/atlas-mark";

const ARTWORK_PATH = "/brand/homeatlas-member-loader-v1.webp";

export function PortalLoadingScreen() {
  return (
    <main
      className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-[#050605] text-[#f4eddf]"
      role="status"
      aria-live="polite"
      aria-label="Preparing your HomeAtlas portal"
    >
      <Image
        src={ARTWORK_PATH}
        alt=""
        fill
        unoptimized
        loading="eager"
        fetchPriority="high"
        sizes="100vw"
        className="scale-110 object-cover opacity-35 blur-2xl"
        aria-hidden
      />

      <div className="relative h-[100svh] max-h-[177.7vw] w-[56.28svh] max-w-full overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.72)]">
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
          className="absolute left-1/2 top-[46.9%] flex aspect-square w-[27%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#0a0b08]/75 shadow-[0_0_42px_rgba(5,6,5,0.72)] backdrop-blur-[2px] [--accent:#e4b94f] [--foreground:#f4eddf]"
          aria-hidden
        >
          <AtlasMark size={180} className="h-[88%] w-[88%] text-[#f4eddf]" />
        </div>

        <div className="absolute inset-0" aria-hidden>
          {[22.9, 50, 76.9].map((left, index) => {
            return (
              <span
                key={left}
                className={`portal-loading-dot absolute top-[88.37%] aspect-square w-[3.55%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#e0b646] ${
                  index === 0
                    ? "portal-loading-dot-filled"
                    : "portal-loading-dot-pending"
                }`}
                style={{
                  left: `${left}%`,
                  animationDelay: index === 1 ? "650ms" : "1500ms",
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
