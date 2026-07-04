"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import { useGoogleReviewsClient } from "@/lib/reviews/use-google-reviews-client";
import { buildReviewsTitle } from "@/components/reviews/review-card";
import { ROUTES } from "@/lib/navigation/config";
import { useBootLayerDelay } from "@/components/motion/boot-provider";
import { ShimmerBlock } from "@/components/motion/shimmer-block";
import { StatusPulse } from "@/components/motion/status-pulse";
import { riseSubtle } from "@/lib/motion/system";

interface ProductionPlaceStatus {
  configured: boolean;
  placeId: string | null;
  businessName: string | null;
  rating: number | null;
  reviewCount: number | null;
  likelySqueegeeKing: boolean;
  mismatchReason: string | null;
}

export function AdminLiveGoogleReviews() {
  const { response, loading } = useGoogleReviewsClient();
  const [production, setProduction] = useState<ProductionPlaceStatus | null>(
    null,
  );
  const [freshPulse, setFreshPulse] = useState(false);
  const hadData = useRef(false);
  const reduceMotion = useReducedMotion();
  const delay = useBootLayerDelay("reviews");

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/google-reviews/status", {
          headers: getAdminRequestHeaders(),
          cache: "no-store",
        });
        if (!res.ok) return;
        setProduction((await res.json()) as ProductionPlaceStatus);
      } catch {
        // PIN session may be missing on public routes — ignore
      }
    })();
  }, []);

  useEffect(() => {
    const data = response?.data;
    const isLive =
      response?.status === "live" &&
      data &&
      !data.isSampleData &&
      data.totalCount > 0;
    if (isLive && !hadData.current) {
      hadData.current = true;
      setFreshPulse(true);
    }
  }, [response]);

  if (loading) {
    return (
      <ShimmerBlock className="rounded-[1.75rem] border border-border/60 px-6 py-5 sm:px-7">
        <p className="text-[10px] uppercase tracking-[0.28em] text-muted">
          Google Reviews
        </p>
        <div className="mt-4 h-8 w-48 rounded-lg bg-background/40" />
      </ShimmerBlock>
    );
  }

  const data = response?.data;
  const isLive =
    response?.status === "live" && data && !data.isSampleData && data.totalCount > 0;
  const wrongPlace =
    production?.configured &&
    production.likelySqueegeeKing === false &&
    production.mismatchReason;

  return (
    <StatusPulse active={freshPulse}>
      <motion.article
        initial={reduceMotion ? false : "hidden"}
        animate="visible"
        variants={riseSubtle}
        transition={{ delay }}
        className="rounded-[1.75rem] border border-border/60 bg-background/30 px-6 py-5 sm:px-7"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-[10px] uppercase tracking-[0.28em] text-muted">
            Google Reviews
          </p>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[9px] uppercase tracking-[0.16em] ${
              wrongPlace
                ? "border-amber-500/40 text-amber-700"
                : isLive
                  ? "border-accent/30 text-accent"
                  : "border-border text-muted/70"
            }`}
          >
            {wrongPlace
              ? "Wrong place?"
              : isLive
                ? "Live"
                : response?.status ?? "unavailable"}
          </span>
        </div>

        {wrongPlace && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 text-xs leading-relaxed text-amber-900">
            <p className="font-medium text-amber-950">
              Connected Place may not be SqueegeeKing
            </p>
            <p className="mt-1">
              Production{" "}
              <code className="text-[10px]">GOOGLE_PLACE_ID</code> resolves to{" "}
              <strong>{production.businessName ?? "unknown"}</strong>
              {production.rating != null && production.reviewCount != null
                ? ` (${production.rating.toFixed(1)} stars · ${production.reviewCount} reviews)`
                : ""}
              . Expected ~5.0 stars and ~116 reviews for SqueegeeKing.
            </p>
            {production.placeId && (
              <p className="mt-2 font-mono text-[10px] text-amber-950/80">
                {production.placeId}
              </p>
            )}
            <Link
              href={ROUTES.setupGoogleReviews}
              className="mt-3 inline-block text-[10px] uppercase tracking-[0.18em] text-amber-950 underline"
            >
              Reconnect via Google Business OAuth →
            </Link>
          </div>
        )}

        {isLive && data ? (
          <>
            <p className="mt-3 font-serif text-3xl font-light text-foreground">
              {buildReviewsTitle(data)}
            </p>
            {production?.businessName && (
              <p className="mt-2 text-sm text-foreground/85">
                {production.businessName}
              </p>
            )}
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Pulled from Google Places — same source as the website and Home
              Care Plans. Cached up to 8 hours.
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {response?.message ?? "Google reviews temporarily unavailable."}
            {!isLive && (
              <span className="mt-3 block">
                <Link
                  href={ROUTES.setupGoogleReviews}
                  className="text-[10px] uppercase tracking-[0.18em] text-accent hover:underline"
                >
                  Open Google Reviews setup wizard →
                </Link>
              </span>
            )}
          </p>
        )}
      </motion.article>
    </StatusPulse>
  );
}
