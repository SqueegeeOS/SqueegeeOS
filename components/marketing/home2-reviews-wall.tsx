"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReviewRailAutoplay } from "@/components/marketing/reviews-carousel";
import { useNearViewport } from "@/components/reviews/use-near-viewport";
import type {
  GoogleReviewsApiResponse,
  Review,
  ReviewsData,
} from "@/lib/reviews/types";

interface ReviewItem {
  id: string;
  author: string;
  rating: number;
  text: string;
  when: string;
  profilePhotoUrl?: string;
  reviewerProfileUrl?: string;
  reviewUrl?: string;
}

interface ReviewMeta {
  rating?: number;
  count?: number;
  provider?: ReviewsData["provider"];
  businessUrl?: string;
}

export function isDisplayableReview(review: Review): boolean {
  return (
    review.source === "Google" &&
    review.reviewerName.trim().length > 0 &&
    Number.isFinite(review.rating) &&
    review.rating >= 1 &&
    review.rating <= 5
  );
}

export function Home2ReviewsWall() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [meta, setMeta] = useState<ReviewMeta>({});
  const [hasOverflow, setHasOverflow] = useState(false);
  const [canScrollPrevious, setCanScrollPrevious] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);
  const { targetRef: reviewLoadRef, shouldLoad } = useNearViewport();
  const carousel = useReviewRailAutoplay(railRef, {
    hasOverflow,
    itemCount: items.length,
    reducedMotion,
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
        if (data.provider === "google_places" && !data.businessUrl) return;

        const mapped = data.reviews
          .filter(isDisplayableReview)
          .map((review) => ({
            id: review.id,
            author: review.reviewerName,
            rating: review.rating,
            text: review.reviewText,
            when: review.relativeDate ?? "",
            profilePhotoUrl: review.profilePhotoUrl,
            reviewerProfileUrl: review.reviewerProfileUrl,
            reviewUrl: review.reviewUrl,
          }));

        if (mapped.length === 0) return;

        setItems(mapped);
        setMeta({
          rating: data.averageRating > 0 ? data.averageRating : undefined,
          count: data.totalCount > 0 ? data.totalCount : undefined,
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
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
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
      behavior: reducedMotion ? "auto" : "smooth",
    });
  };

  if (items.length === 0) {
    return <div ref={reviewLoadRef} aria-hidden className="min-h-px" />;
  }

  const placesPreview = meta.provider === "google_places";

  return (
    <section
      aria-labelledby="google-reviews-heading"
      className="overflow-hidden border-b border-[var(--editorial-rule)] bg-[var(--editorial-canvas)] py-24 sm:py-28"
      onBlurCapture={carousel.onBlurCapture}
      onFocusCapture={carousel.onFocusCapture}
      onMouseEnter={carousel.onMouseEnter}
      onMouseLeave={carousel.onMouseLeave}
    >
      <div className="mx-auto flex w-full max-w-[90rem] items-end justify-between gap-5 px-5 sm:px-8 lg:px-10">
        <div>
          <p className="text-xs text-[var(--editorial-accent)]">
            Verified words /{" "}
            <span
              translate="no"
              style={placesPreview ? { color: "#5E5E5E" } : undefined}
              className="whitespace-nowrap font-sans text-xs font-normal normal-case tracking-normal"
            >
              {placesPreview ? "Google Maps" : "Google"}
            </span>
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
          {placesPreview && (
            <p className="mt-2 font-sans text-xs font-normal normal-case leading-relaxed tracking-normal text-[var(--editorial-muted)]">
              <a
                href={meta.businessUrl}
                target="_blank"
                rel="noreferrer"
                translate="no"
                style={{ color: "#5E5E5E" }}
                className="whitespace-nowrap font-sans text-xs font-normal normal-case tracking-normal underline-offset-4 hover:underline"
              >
                Google Maps
              </a>{" "}
              preview ordered by Google relevance; this site applies no rating
              filter.
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
        aria-label="Google customer reviews. Swipe or use the arrow buttons to browse."
        onPointerDown={carousel.pauseAfterManualNavigation}
        tabIndex={0}
        className="mx-auto mt-14 flex w-full max-w-[90rem] cursor-grab snap-x snap-mandatory scroll-px-5 gap-6 overflow-x-auto px-5 pb-4 outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-[var(--editorial-accent)] focus-visible:ring-inset active:cursor-grabbing sm:scroll-px-8 sm:px-8 lg:scroll-px-10 lg:px-10 [&::-webkit-scrollbar]:hidden"
      >
        {items.map((review) => {
          const sourceUrl = review.reviewUrl ?? meta.businessUrl;
          return (
            <figure
              key={review.id}
              className="w-[min(82vw,24rem)] flex-none snap-start border-t border-[var(--editorial-rule)] pt-6 transition-transform duration-500 hover:-translate-y-1 motion-reduce:transition-none md:w-[calc((100%_-_1.5rem)/2)] xl:w-[calc((100%_-_4.5rem)/4)]"
            >
              <div className="flex items-center gap-3">
                {review.profilePhotoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={review.profilePhotoUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-9 w-9 rounded-full object-cover"
                  />
                )}
                <p
                  aria-label={`${review.rating} out of 5 stars`}
                  className="font-mono text-xs tracking-[0.18em] text-[var(--editorial-accent)]"
                >
                  <span aria-hidden>{"★".repeat(Math.round(review.rating))}</span>
                </p>
              </div>
              {review.text.trim() ? (
                <blockquote className="mt-5 font-serif text-xl font-light leading-snug text-[var(--editorial-ink)] sm:text-2xl">
                  “{review.text}”
                </blockquote>
              ) : (
                <p className="mt-5 text-sm text-[var(--editorial-muted)]">
                  Rating-only review
                </p>
              )}
              <figcaption className="mt-6 border-t border-[var(--editorial-rule)] pt-4 text-xs leading-relaxed text-[var(--editorial-muted)]">
                {review.reviewerProfileUrl ? (
                  <a
                    href={review.reviewerProfileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline-offset-4 hover:underline"
                  >
                    {review.author}
                  </a>
                ) : (
                  review.author
                )}
                {review.when ? ` / ${review.when}` : ""}
                {sourceUrl && (
                  <>
                    {" / "}
                    <a
                      href={sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      translate="no"
                      style={
                        placesPreview ? { color: "#5E5E5E" } : undefined
                      }
                      className="whitespace-nowrap font-sans text-xs font-normal normal-case tracking-normal underline-offset-4 hover:underline"
                    >
                      {placesPreview ? "Google Maps" : "Google"}
                    </a>
                  </>
                )}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}
