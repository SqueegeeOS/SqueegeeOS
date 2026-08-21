import Image from "next/image";
import { AtlasMark } from "@/components/theme/atlas-mark";

const ARTWORK_PATH = "/brand/homeatlas-member-loader-v2.webp";
const ARTWORK_BLUR_DATA_URL =
  "data:image/webp;base64,UklGRkoAAABXRUJQVlA4ID4AAAAQAwCdASoKABIAPzmGuVOvKSWisAgB4CcJZwAASQcvsgAA/tHdxhowQYpqnn2Ga/2u2Uo+yAb/fO7q2hAAAA==";

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
        placeholder="blur"
        blurDataURL={ARTWORK_BLUR_DATA_URL}
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
          placeholder="blur"
          blurDataURL={ARTWORK_BLUR_DATA_URL}
          sizes="(max-aspect-ratio:941/1672) 100vw, 56.28svh"
          className="object-contain"
          aria-hidden
        />

        <div
          className="absolute left-1/2 top-[46.9%] flex aspect-square w-[24%] -translate-x-1/2 -translate-y-1/2 items-center justify-center [--accent:#e4b94f] [--foreground:#f4eddf]"
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
