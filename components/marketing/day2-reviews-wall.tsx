"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useReviewRailAutoplay } from "@/components/marketing/reviews-carousel";
import { useNearViewport } from "@/components/reviews/use-near-viewport";
import type {
  GoogleReviewsApiResponse,
  Review,
  ReviewsData,
} from "@/lib/reviews/types";

const PINE = "#173f32";
const BRONZE = "#99683d";
const BRONZE_TEXT = "#8f5f37";
const SAGE = "#526b60";

interface ReviewItem {
  id: string;
  author: string;
  rating: number;
  text: string;
  when: string;
  provider?: ReviewsData["provider"];
  profilePhotoUrl?: string;
  reviewerProfileUrl?: string;
  reviewUrl?: string;
}

type ReviewCoverage = "complete" | "partial" | "preview";

interface ReviewWallCopy {
  countLabel: string;
  description: string;
  orderingDisclosure?: string;
}

export function getDay2ReviewWallCopy({
  coverage,
  displayedCount,
  totalCount,
  provider,
}: {
  coverage?: ReviewCoverage;
  displayedCount: number;
  totalCount?: number;
  provider?: ReviewsData["provider"];
}): ReviewWallCopy {
  const count = totalCount && totalCount > 0 ? totalCount : displayedCount;

  if (coverage === "complete") {
    return {
      countLabel: `all ${count} reviews`,
      description:
        "Every review from our Google Business Profile — unfiltered and in full.",
    };
  }

  if (coverage === "partial") {
    return {
      countLabel:
        count > displayedCount
          ? `${displayedCount} of ${count} reviews synced`
          : `${displayedCount} reviews synced so far`,
      description:
        "Showing the reviews Google has synced so far, with ratings and full comments left intact.",
    };
  }

  return {
    countLabel:
      count > displayedCount
        ? `${displayedCount} of ${count} reviews shown`
        : `${displayedCount} reviews shown`,
    description:
      provider === "google_places"
        ? "A live Google Maps preview, with ratings and full available comments shown."
        : "Live highlights from Google while the complete review archive finishes connecting.",
    orderingDisclosure:
      provider === "google_places"
        ? "Google Maps orders this preview by relevance; Squeegee King applies no rating filter."
        : undefined,
  };
}

export function getDay2ReviewAttribution(
  provider?: ReviewsData["provider"],
): {
  label: "Google" | "Google Maps";
  translate: "no";
  style: {
    fontSize: "12px";
    fontWeight: 400;
    letterSpacing: "normal";
    fontFamily: "Roboto, Arial, sans-serif";
    fontStyle: "normal";
    whiteSpace: "nowrap";
    color: "#1F1F1F";
  };
} {
  return {
    label: provider === "google_places" ? "Google Maps" : "Google",
    translate: "no",
    style: {
      fontSize: "12px",
      fontWeight: 400,
      letterSpacing: "normal",
      fontFamily: "Roboto, Arial, sans-serif",
      fontStyle: "normal",
      whiteSpace: "nowrap",
      color: "#1F1F1F",
    },
  };
}

function formatReviewDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function isDisplayableDay2Review(review: Review): boolean {
  return (
    review.source === "Google" &&
    review.reviewerName.trim().length > 0 &&
    Number.isFinite(review.rating) &&
    review.rating >= 1 &&
    review.rating <= 5
  );
}

export function Day2ReviewsWall({ reduced }: { reduced: boolean }) {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [meta, setMeta] = useState<{
    rating?: number;
    count?: number;
    coverage?: ReviewCoverage;
    provider?: ReviewsData["provider"];
    businessUrl?: string;
  }>({});
  const [hasOverflow, setHasOverflow] = useState(false);
  const [canScrollPrevious, setCanScrollPrevious] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);
  const { targetRef: reviewLoadRef, shouldLoad } = useNearViewport();
  const carousel = useReviewRailAutoplay(railRef, {
    hasOverflow,
    itemCount: items.length,
    reducedMotion: reduced,
  });

  const updateScrollState = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;

    const overflow = rail.scrollWidth > rail.clientWidth + 1;
    setHasOverflow(overflow);
    setCanScrollPrevious(overflow && rail.scrollLeft > 2);
    setCanScrollNext(
      overflow && rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 2,
    );
  }, []);

  useEffect(() => {
    if (!shouldLoad) return;
    const controller = new AbortController();

    fetch("/api/reviews/google", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: GoogleReviewsApiResponse | null) => {
        if (
          !payload ||
          (payload.status !== "live" && payload.status !== "cached") ||
          !payload.data
        ) {
          return;
        }
        const data = payload.data;

        const mapped: ReviewItem[] = data.reviews
          .filter(isDisplayableDay2Review)
          .map((review) => ({
            id: review.id,
            author: review.reviewerName,
            rating: review.rating,
            text: review.reviewText,
            when: review.relativeDate ?? formatReviewDate(review.reviewDate),
            provider: data.provider,
            profilePhotoUrl: review.profilePhotoUrl,
            reviewerProfileUrl: review.reviewerProfileUrl,
            reviewUrl: review.reviewUrl,
          }));

        setItems(mapped);
        setMeta({
          rating:
            data.averageRating > 0 ? data.averageRating : undefined,
          count:
            data.totalCount > 0 ? data.totalCount : undefined,
          coverage: data.coverage,
          provider: data.provider,
          businessUrl: data.businessUrl,
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
      });

    return () => controller.abort();
  }, [shouldLoad]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const initialFrame = requestAnimationFrame(updateScrollState);
    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(rail);
    rail.addEventListener("scroll", updateScrollState, { passive: true });

    return () => {
      cancelAnimationFrame(initialFrame);
      resizeObserver.disconnect();
      rail.removeEventListener("scroll", updateScrollState);
    };
  }, [items.length, updateScrollState]);

  const scrollReviews = (direction: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;
    carousel.pauseAfterManualNavigation();
    rail.scrollBy({
      left: direction * Math.max(rail.clientWidth - 32, 240),
      behavior: reduced ? "auto" : "smooth",
    });
  };

  if (items.length === 0) {
    return <div ref={reviewLoadRef} aria-hidden className="min-h-px" />;
  }

  const wallCopy = getDay2ReviewWallCopy({
    coverage: meta.coverage,
    displayedCount: items.length,
    totalCount: meta.count,
    provider: meta.provider,
  });
  const headerAttribution = getDay2ReviewAttribution(meta.provider);

  return (
    <section
      className="overflow-hidden border-y py-20 sm:py-24"
      style={{
        borderColor: "rgba(23,63,50,0.1)",
        background: "#f1ede3",
      }}
      aria-label="Reviews"
      onBlurCapture={carousel.onBlurCapture}
      onFocusCapture={carousel.onFocusCapture}
      onMouseEnter={carousel.onMouseEnter}
      onMouseLeave={carousel.onMouseLeave}
    >
      <div className="mx-auto flex w-full max-w-[90rem] flex-col items-start justify-between gap-7 px-5 sm:flex-row sm:items-end sm:px-8 lg:px-12">
        <div className="max-w-2xl">
          <p
            className="font-mono text-[11px] uppercase tracking-[0.3em]"
            style={{ color: BRONZE_TEXT }}
          >
            {meta.rating ? `★ ${meta.rating.toFixed(1)} on ` : "On "}
            <span
              className="normal-case"
              translate={headerAttribution.translate}
              style={headerAttribution.style}
            >
              {headerAttribution.label}
            </span>
            {` · ${wallCopy.countLabel}`}
          </p>
          <h2
            className="mt-4 text-balance font-serif text-4xl font-light leading-[0.98] sm:mt-5 sm:text-6xl"
            style={{ color: PINE }}
          >
            The neighbors talk.
          </h2>
          <p className="mt-4 max-w-xl text-pretty text-sm leading-relaxed sm:text-base" style={{ color: SAGE }}>
            {wallCopy.description}
          </p>
          {wallCopy.orderingDisclosure ? (
            <p className="mt-2 max-w-xl text-xs leading-relaxed" style={{ color: SAGE }}>
              {wallCopy.orderingDisclosure}
            </p>
          ) : null}
        </div>
        {hasOverflow && (
          <div className="flex shrink-0 self-end gap-2" role="group" aria-label="Review navigation">
            <button
              type="button"
              onClick={() => scrollReviews(-1)}
              disabled={!canScrollPrevious}
              aria-label="Previous reviews"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[#173f32]/15 bg-[#fffdf8] text-lg text-[#173f32] shadow-sm transition-[border-color,background-color,opacity] duration-200 outline-none hover:border-[#99683d]/35 hover:bg-[#fffaf0] focus-visible:ring-2 focus-visible:ring-[#173f32] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f1ede3] disabled:cursor-not-allowed disabled:opacity-35 motion-reduce:transition-none"
            >
              <span aria-hidden>←</span>
            </button>
            <button
              type="button"
              onClick={() => scrollReviews(1)}
              disabled={!canScrollNext}
              aria-label="Next reviews"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[#173f32]/15 bg-[#fffdf8] text-lg text-[#173f32] shadow-sm transition-[border-color,background-color,opacity] duration-200 outline-none hover:border-[#99683d]/35 hover:bg-[#fffaf0] focus-visible:ring-2 focus-visible:ring-[#173f32] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f1ede3] disabled:cursor-not-allowed disabled:opacity-35 motion-reduce:transition-none"
            >
              <span aria-hidden>→</span>
            </button>
          </div>
        )}
      </div>
      <div
        ref={railRef}
        role="region"
        aria-roledescription="carousel"
        aria-label={`${headerAttribution.label} customer reviews. Swipe or use the arrow buttons to browse.`}
        onPointerDown={carousel.pauseAfterManualNavigation}
        tabIndex={0}
        className="mx-auto mt-10 flex w-full max-w-[90rem] cursor-grab snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-4 outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-[#99683d] focus-visible:ring-inset active:cursor-grabbing sm:mt-12 sm:scroll-px-8 sm:px-8 md:gap-6 lg:scroll-px-12 lg:px-12 [&::-webkit-scrollbar]:hidden"
      >
        {items.map((review) => {
          const attribution = getDay2ReviewAttribution(review.provider);

          return (
            <figure
              key={review.id}
              className="group flex min-h-[17rem] w-[min(82vw,20rem)] flex-none snap-start flex-col rounded-[1.25rem] border border-[#173f32]/10 bg-[linear-gradient(145deg,#fffdf8_0%,#faf6ec_100%)] p-6 shadow-[0_20px_55px_-42px_rgba(23,63,50,0.38)] transition-[transform,border-color,box-shadow] duration-500 hover:-translate-y-1 hover:border-[#99683d]/25 hover:shadow-[0_28px_70px_-42px_rgba(23,63,50,0.52)] motion-reduce:transition-none md:w-[calc((100%_-_1.5rem)/2)] md:max-w-none xl:w-[calc((100%_-_4.5rem)/4)]"
            >
            <div className="flex items-center justify-between gap-3">
              <p
                aria-label={`${review.rating} out of 5 stars`}
                className="font-mono text-xs tracking-[0.2em]"
                style={{ color: BRONZE }}
              >
                <span aria-hidden>{"★".repeat(Math.round(review.rating))}</span>
              </p>
              {review.reviewUrl ? (
                <a
                  href={review.reviewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-[#173f32]/10 px-2.5 py-1 normal-case underline-offset-2 hover:underline"
                  translate={attribution.translate}
                  style={attribution.style}
                  aria-label={`Open ${review.author}'s review on ${attribution.label}`}
                >
                  {attribution.label} <span aria-hidden>↗</span>
                </a>
              ) : (
                <span
                  className="rounded-full border border-[#173f32]/10 px-2.5 py-1 normal-case"
                  translate={attribution.translate}
                  style={attribution.style}
                >
                  {attribution.label}
                </span>
              )}
            </div>
            {review.text ? (
              <blockquote
                className="mt-5 flex-1 font-serif text-[1.05rem] font-light leading-relaxed"
                style={{ color: PINE }}
              >
                &ldquo;{review.text}&rdquo;
              </blockquote>
            ) : (
              <p
                className="mt-5 flex-1 font-serif text-[1.05rem] font-light italic leading-relaxed"
                style={{ color: SAGE }}
              >
                Rating only — no written comment.
              </p>
            )}
            <figcaption
              className="mt-6 flex items-center gap-3 border-t border-[#173f32]/10 pt-4 text-xs"
              style={{ color: SAGE }}
            >
              {review.profilePhotoUrl ? (
                <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-[#173f32]">
                  {/* Google supplies this author photo as part of the review attribution. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={review.profilePhotoUrl}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                </span>
              ) : (
                <span
                  aria-hidden
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#173f32] font-serif text-sm text-[#fffdf8]"
                >
                  {review.author.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span>
                {review.reviewerProfileUrl ? (
                  <a
                    href={review.reviewerProfileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block font-medium underline-offset-2 hover:underline"
                    style={{ color: PINE }}
                    aria-label={`Open ${review.author}'s Google profile`}
                  >
                    {review.author}
                  </a>
                ) : (
                  <span className="block font-medium" style={{ color: PINE }}>
                    {review.author}
                  </span>
                )}
                {review.when ? <span>{review.when}</span> : null}
              </span>
            </figcaption>
            </figure>
          );
        })}
      </div>
      <div className="mx-auto mt-7 flex w-full max-w-[90rem] flex-col items-start justify-between gap-5 px-5 sm:mt-9 sm:flex-row sm:items-center sm:px-8 lg:px-12">
        <div>
          <p className="max-w-xl text-sm leading-relaxed" style={{ color: SAGE }}>
            Your home can be the next one cared for the right way.
          </p>
          {meta.businessUrl ? (
            <a
              href={meta.businessUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex text-xs font-medium underline decoration-[#99683d]/35 underline-offset-4 transition-colors hover:text-[#99683d]"
              style={{ color: PINE }}
            >
              See the original reviews on&nbsp;
              <span
                className="normal-case"
                translate={headerAttribution.translate}
                style={headerAttribution.style}
              >
                {headerAttribution.label}
              </span>
              <span aria-hidden>&nbsp;↗</span>
            </a>
          ) : null}
        </div>
        <Link
          href="/request"
          className="group inline-flex min-h-12 items-center justify-center gap-3 rounded-full border border-[#173f32]/15 bg-[#fffdf8] px-6 text-sm font-medium tracking-[0.06em] text-[#173f32] shadow-sm transition-[background-color,border-color,transform] duration-300 outline-none hover:-translate-y-0.5 hover:border-[#99683d]/35 hover:bg-[#fffaf0] focus-visible:ring-2 focus-visible:ring-[#99683d] focus-visible:ring-offset-4 focus-visible:ring-offset-[#f1ede3] motion-reduce:transform-none motion-reduce:transition-none"
        >
          Get a free quote
          <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none">
            &rarr;
          </span>
        </Link>
      </div>
    </section>
  );
}
