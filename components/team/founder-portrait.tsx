"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { resolveFounderPortraitSrc } from "@/lib/team/founders";
import type { FounderProfile } from "@/lib/team/types";
import { PORTRAIT_ASPECT } from "@/lib/team/types";
import { PORTRAIT_IMAGE_SIZES } from "@/lib/team/portraits";
import { FounderPortraitPlaceholder } from "./founder-portrait-placeholder";

type PortraitLayout = "card" | "mobile" | "hero";

interface FounderPortraitProps {
  founder: FounderProfile;
  layout?: PortraitLayout;
  priority?: boolean;
  className?: string;
}

const layoutConfig: Record<
  PortraitLayout,
  {
    aspect: keyof typeof PORTRAIT_ASPECT;
    sizes: string;
    primary: "desktop" | "mobile" | "full";
    fallback: "mobile" | "desktop";
  }
> = {
  card: {
    aspect: "card",
    sizes: PORTRAIT_IMAGE_SIZES.card,
    primary: "desktop",
    fallback: "mobile",
  },
  mobile: {
    aspect: "mobile",
    sizes: PORTRAIT_IMAGE_SIZES.card,
    primary: "mobile",
    fallback: "desktop",
  },
  hero: {
    aspect: "hero",
    sizes: PORTRAIT_IMAGE_SIZES.hero,
    primary: "full",
    fallback: "mobile",
  },
};

export function FounderPortrait({
  founder,
  layout = "card",
  priority = false,
  className = "",
}: FounderPortraitProps) {
  const config = layoutConfig[layout];
  const primarySrc = resolveFounderPortraitSrc(founder, config.primary);
  const fallbackSrc = resolveFounderPortraitSrc(founder, config.fallback);

  const sources = useMemo(
    () => [primarySrc, fallbackSrc].filter((s, i, arr) => arr.indexOf(s) === i),
    [primarySrc, fallbackSrc],
  );

  const [sourceIndex, setSourceIndex] = useState(0);
  const [exhausted, setExhausted] = useState(false);

  const currentSrc = sources[sourceIndex];
  const ratio = PORTRAIT_ASPECT[config.aspect];

  if (exhausted || !currentSrc) {
    return (
      <FounderPortraitPlaceholder
        kind={founder.portraitPlaceholder}
        aspect={config.aspect}
        className={className}
      />
    );
  }

  return (
    <div
      className={`relative w-full overflow-hidden bg-[#080808] ${className}`}
      style={{ aspectRatio: String(ratio) }}
    >
      <Image
        src={currentSrc}
        alt={`Portrait of ${founder.name}`}
        fill
        priority={priority}
        loading={priority ? undefined : "lazy"}
        sizes={config.sizes}
        className="object-cover object-center"
        onError={() => {
          if (sourceIndex < sources.length - 1) {
            setSourceIndex((i) => i + 1);
          } else {
            setExhausted(true);
          }
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
    </div>
  );
}
