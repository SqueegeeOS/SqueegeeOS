"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useReviewRailAutoplay } from "@/components/marketing/reviews-carousel";
import type { GoogleReviewsApiResponse, Review } from "@/lib/reviews/types";

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
}

export function isDisplayableDay2Review(review: Review): boolean {
  return (
    review.source === "Google" &&
    review.reviewText.trim().length > 0 &&
    review.reviewerName.trim().length > 0 &&
    Number.isFinite(review.rating) &&
    review.rating >= 4 &&
    review.rating <= 5
  );
}

export function Day2ReviewsWall({ reduced }: { reduced: boolean }) {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [meta, setMeta] = useState<{ rating?: number; count?: number }>({});
  const [hasOverflow, setHasOverflow] = useState(false);
  const [canScrollPrevious, setCanScrollPrevious] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);
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

        const mapped: ReviewItem[] = payload.data.reviews
          .filter(isDisplayableDay2Review)
          .slice(0, 8)
          .map((review) => ({
            id: review.id,
            author: review.reviewerName,
            rating: review.rating,
            text: review.reviewText.slice(0, 220),
            when: review.relativeDate ?? "",
          }));

        setItems(mapped);
        setMeta({
          rating:
            payload.data.averageRating > 0
              ? payload.data.averageRating
              : undefined,
          count:
            payload.data.totalCount > 0 ? payload.data.totalCount : undefined,
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
      });

    return () => controller.abort();
  }, []);

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

  if (items.length === 0) return null;

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
            {meta.rating ? `★ ${meta.rating.toFixed(1)} on Google` : "On Google"}
            {meta.count ? ` · ${meta.count} reviews` : ""}
          </p>
          <h2
            className="mt-4 text-balance font-serif text-4xl font-light leading-[0.98] sm:mt-5 sm:text-6xl"
            style={{ color: PINE }}
          >
            The neighbors talk.
          </h2>
          <p className="mt-4 max-w-xl text-pretty text-sm leading-relaxed sm:text-base" style={{ color: SAGE }}>
            Real Google reviews from homeowners who trusted us with the view.
          </p>
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
        aria-label="Google customer reviews. Swipe or use the arrow buttons to browse."
        onPointerDown={carousel.pauseAfterManualNavigation}
        tabIndex={0}
        className="mx-auto mt-10 flex w-full max-w-[90rem] cursor-grab snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-4 outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-[#99683d] focus-visible:ring-inset active:cursor-grabbing sm:mt-12 sm:scroll-px-8 sm:px-8 md:gap-6 lg:scroll-px-12 lg:px-12 [&::-webkit-scrollbar]:hidden"
      >
        {items.map((review) => (
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
              <span
                className="rounded-full border border-[#173f32]/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.18em]"
                style={{ color: SAGE }}
              >
                Google
              </span>
            </div>
            <blockquote
              className="mt-5 flex-1 font-serif text-[1.05rem] font-light leading-relaxed"
              style={{ color: PINE }}
            >
              &ldquo;{review.text}&rdquo;
            </blockquote>
            <figcaption
              className="mt-6 flex items-center gap-3 border-t border-[#173f32]/10 pt-4 text-xs"
              style={{ color: SAGE }}
            >
              <span
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#173f32] font-serif text-sm text-[#fffdf8]"
              >
                {review.author.slice(0, 1).toUpperCase()}
              </span>
              <span>
                <span className="block font-medium" style={{ color: PINE }}>
                  {review.author}
                </span>
                {review.when ? <span>{review.when}</span> : null}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="mx-auto mt-7 flex w-full max-w-[90rem] flex-col items-start justify-between gap-5 px-5 sm:mt-9 sm:flex-row sm:items-center sm:px-8 lg:px-12">
        <p className="max-w-xl text-sm leading-relaxed" style={{ color: SAGE }}>
          Your home can be the next one cared for the right way.
        </p>
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
