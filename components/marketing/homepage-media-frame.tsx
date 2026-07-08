"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";
import {
  HOMEPAGE_LAUNCH_FILM,
  HOMEPAGE_MEDIA_POSTER,
} from "@/lib/marketing/homepage-media";

interface HomepageMediaFrameProps {
  fallbackAlt?: string;
  className?: string;
  /** Play video when scrolled into view — never on initial page load. */
  playWhenInView?: boolean;
}

/**
 * Launch film slot — glass frame, poster while loading, image fallback.
 * Video is optional; the layout stays complete without it.
 */
export function HomepageMediaFrame({
  fallbackAlt = "HomeAtlas property care",
  className = "",
  playWhenInView = false,
}: HomepageMediaFrameProps) {
  const reduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const inView = useInView(containerRef, { amount: 0.35, margin: "0px 0px -8% 0px" });
  const [useFallback, setUseFallback] = useState(false);
  const showVideo = Boolean(HOMEPAGE_LAUNCH_FILM) && !useFallback && !reduceMotion;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !showVideo) return;

    if (playWhenInView) {
      if (inView) {
        void video.play().catch(() => setUseFallback(true));
      } else {
        video.pause();
      }
      return;
    }

    void video.play().catch(() => setUseFallback(true));
  }, [inView, playWhenInView, showVideo]);

  return (
    <div
      ref={containerRef}
      className={`craft-glass overflow-hidden rounded-[var(--radius-card-lg)] p-1 shadow-[var(--shadow-lift)] ${className}`}
    >
      <div className="relative aspect-[900/560] overflow-hidden rounded-[calc(var(--radius-card-lg)-4px)] bg-[#0a0a0a]">
        {showVideo ? (
          <video
            ref={videoRef}
            src={HOMEPAGE_LAUNCH_FILM}
            poster={HOMEPAGE_MEDIA_POSTER}
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
