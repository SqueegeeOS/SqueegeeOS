"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GoogleReviewsApiResponse, Review } from "@/lib/reviews/types";

interface ReviewItem {
  id: string;
  author: string;
  rating: number;
  text: string;
  when: string;
}
export function isDisplayableReview(review: Review): boolean {
  return (
    review.source === "Google" &&
    review.reviewText.trim().length > 0 &&
    review.reviewerName.trim().length > 0 &&
    Number.isFinite(review.rating) &&
    review.rating >= 4 &&
    review.rating <= 5
  );
}

export function Home2ReviewsWall() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [meta, setMeta] = useState<{ rating?: number; count?: number }>({});
  const [hasOverflow, setHasOverflow] = useState(false);
  const [canScrollPrevious, setCanScrollPrevious] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);

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

        const mapped = payload.data.reviews
          .filter(isDisplayableReview)
          .slice(0, 8)
          .map((review) => ({
            id: review.id,
            author: review.reviewerName,
            rating: review.rating,
            text: review.reviewText,
            when: review.relativeDate ?? "",
          }));

        if (mapped.length === 0) return;

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

    rail.scrollBy({
      left: direction * Math.max(rail.clientWidth - 32, 240),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  };

  if (items.length === 0) return null;

  return (
    <section
      aria-labelledby="google-reviews-heading"
      className="overflow-hidden border-b border-[var(--editorial-rule)] bg-[var(--editorial-canvas)] py-24 sm:py-28"
    >
      <div className="mx-auto flex w-full max-w-[90rem] items-end justify-between gap-5 px-5 sm:px-8 lg:px-10">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--editorial-accent)] sm:text-[11px]">
            Verified words / Google
          </p>
          <h2
            id="google-reviews-heading"
            className="mt-6 max-w-3xl font-serif text-[clamp(3rem,6vw,6.5rem)] font-light leading-[0.88] tracking-[-0.035em]"
          >
            In homeowners&apos; own words.
          </h2>
          {(meta.rating || meta.count) && (
            <p className="mt-5 text-sm text-[var(--editorial-muted)]">
              {meta.rating ? `${meta.rating.toFixed(1)} average rating` : ""}
              {meta.rating && meta.count ? " / " : ""}
              {meta.count ? `${meta.count} Google reviews` : ""}
            </p>
          )}
        </div>

        {hasOverflow && (
          <div
            className="flex shrink-0 gap-2"
            role="group"
            aria-label="Review navigation"
          >
            <button
              type="button"
              onClick={() => scrollReviews(-1)}
              disabled={!canScrollPrevious}
              aria-label="Previous reviews"
              className="flex h-[52px] w-[52px] items-center justify-center border border-[var(--editorial-rule)] bg-[var(--editorial-paper)] text-lg text-[var(--editorial-ink)] outline-none transition-[background-color,opacity] duration-200 hover:bg-[var(--editorial-sage)] focus-visible:ring-2 focus-visible:ring-[var(--editorial-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--editorial-canvas)] disabled:cursor-not-allowed disabled:opacity-35 motion-reduce:transition-none"
            >
              <span aria-hidden>←</span>
            </button>
            <button
              type="button"
              onClick={() => scrollReviews(1)}
              disabled={!canScrollNext}
              aria-label="Next reviews"
              className="flex h-[52px] w-[52px] items-center justify-center border border-[var(--editorial-rule)] bg-[var(--editorial-paper)] text-lg text-[var(--editorial-ink)] outline-none transition-[background-color,opacity] duration-200 hover:bg-[var(--editorial-sage)] focus-visible:ring-2 focus-visible:ring-[var(--editorial-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--editorial-canvas)] disabled:cursor-not-allowed disabled:opacity-35 motion-reduce:transition-none"
            >
              <span aria-hidden>→</span>
            </button>
          </div>
        )}
      </div>

      <div
        ref={railRef}
        className="mx-auto mt-14 flex w-full max-w-[90rem] snap-x snap-mandatory scroll-px-5 gap-6 overflow-x-auto px-5 pb-4 sm:scroll-px-8 sm:px-8 lg:scroll-px-10 lg:px-10"
      >
        {items.map((review) => (
          <figure
            key={review.id}
            className="w-[min(82vw,24rem)] flex-none snap-start border-t border-[var(--editorial-rule)] pt-6 md:w-[calc((100%_-_1.5rem)/2)] xl:w-[calc((100%_-_4.5rem)/4)]"
          >
            <p
              aria-label={`${review.rating} out of 5 stars`}
              className="font-mono text-xs tracking-[0.18em] text-[var(--editorial-accent)]"
            >
              <span aria-hidden>{"★".repeat(Math.round(review.rating))}</span>
            </p>
            <blockquote className="mt-5 font-serif text-xl font-light leading-snug text-[var(--editorial-ink)] sm:text-2xl">
              “{review.text}”
            </blockquote>
            <figcaption className="mt-6 border-t border-[var(--editorial-rule)] pt-4 text-xs leading-relaxed text-[var(--editorial-muted)]">
              {review.author}
              {review.when ? ` / ${review.when}` : ""}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
