"use client";

import Image from "next/image";
import { useReducedMotion } from "framer-motion";
import { useState } from "react";
import {
  HOMEPAGE_LAUNCH_FILM,
  HOMEPAGE_MEDIA_POSTER,
} from "@/lib/marketing/homepage-media";

interface HomepageMediaFrameProps {
  fallbackAlt?: string;
  className?: string;
}

/**
 * Launch film slot — glass frame, poster while loading, image fallback.
 * Video is optional; the layout stays complete without it.
 */
export function HomepageMediaFrame({
  fallbackAlt = "HomeAtlas property care",
  className = "",
}: HomepageMediaFrameProps) {
  const reduceMotion = useReducedMotion();
  const [useFallback, setUseFallback] = useState(false);
  const showVideo = Boolean(HOMEPAGE_LAUNCH_FILM) && !useFallback && !reduceMotion;

  return (
    <div
      className={`craft-glass overflow-hidden rounded-[var(--radius-card-lg)] p-1 shadow-[var(--shadow-lift)] ${className}`}
    >
      <div className="relative aspect-[900/560] overflow-hidden rounded-[calc(var(--radius-card-lg)-4px)] bg-[#0a0a0a]">
        {showVideo ? (
          <video
            src={HOMEPAGE_LAUNCH_FILM}
            poster={HOMEPAGE_MEDIA_POSTER}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setUseFallback(true)}
          />
        ) : (
          <Image
            src={HOMEPAGE_MEDIA_POSTER}
            alt={fallbackAlt}
            fill
            sizes="(max-width: 900px) 100vw, 900px"
            className="object-cover"
            priority={false}
          />
        )}
      </div>
    </div>
  );
}
