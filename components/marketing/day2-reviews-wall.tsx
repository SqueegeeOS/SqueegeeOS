"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const PINE = "#173f32";
const BRONZE = "#99683d";
const BRONZE_TEXT = "#8f5f37";
const SAGE = "#526b60";

interface ReviewItem {
  author: string;
  rating: number;
  text: string;
  when: string;
}

export function Day2ReviewsWall({ reduced }: { reduced: boolean }) {
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
    fetch("/api/reviews/google")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const reviewData = data?.data ?? data ?? {};
        const raw = reviewData.reviews ?? reviewData.result?.reviews ?? [];
        const mapped: ReviewItem[] = raw
          .filter((review: { rating?: number }) => (review.rating ?? 0) >= 4)
          .slice(0, 8)
          .map((review: {
            author_name?: string;
            authorName?: string;
            rating?: number;
            text?: string;
            relative_time_description?: string;
            relativeTime?: string;
          }) => ({
            author: review.author_name ?? review.authorName ?? "A neighbor",
            rating: review.rating ?? 5,
            text: (review.text ?? "").slice(0, 220),
            when:
              review.relative_time_description ?? review.relativeTime ?? "",
          }))
          .filter((review: ReviewItem) => review.text.length > 0);

        setItems(mapped);
        setMeta({
          rating: reviewData.rating ?? reviewData.result?.rating,
          count:
            reviewData.userRatingCount ??
            reviewData.user_ratings_total ??
            reviewData.result?.user_ratings_total,
        });
      })
      .catch(() => undefined);
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
      behavior: reduced ? "auto" : "smooth",
    });
  };

  if (items.length === 0) return null;

  return (
    <section
      className="overflow-hidden border-y py-24 sm:py-28"
      style={{
        borderColor: "rgba(23,63,50,0.1)",
        background: "#f1ede3",
      }}
      aria-label="Reviews"
    >
      <div className="mx-auto flex w-full max-w-[90rem] items-end justify-between gap-5 px-5 sm:px-8 lg:px-12">
        <div>
          <p
            className="font-mono text-[11px] uppercase tracking-[0.3em]"
            style={{ color: BRONZE_TEXT }}
          >
            {meta.rating ? `★ ${meta.rating.toFixed(1)} on Google` : "On Google"}
            {meta.count ? ` · ${meta.count} reviews` : ""}
          </p>
          <h2
            className="mt-5 font-serif text-4xl font-light sm:text-6xl"
            style={{ color: PINE }}
          >
            The neighbors talk.
          </h2>
        </div>
        {hasOverflow && (
          <div className="flex shrink-0 gap-2" role="group" aria-label="Review navigation">
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
        className="mx-auto mt-12 flex w-full max-w-[90rem] snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-4 sm:scroll-px-8 sm:px-8 md:gap-6 lg:scroll-px-12 lg:px-12"
      >
        {items.map((review, index) => (
          <figure
            key={`${review.author}-${review.when}-${index}`}
            className="w-[min(82vw,20rem)] flex-none snap-start rounded-[1.25rem] border border-[#173f32]/10 bg-[#fffdf8] p-6 shadow-[0_20px_55px_-42px_rgba(23,63,50,0.38)] md:w-[calc((100%_-_1.5rem)/2)] md:max-w-none xl:w-[calc((100%_-_4.5rem)/4)]"
          >
            <p
              className="font-mono text-xs tracking-[0.2em]"
              style={{ color: BRONZE }}
            >
              {"★".repeat(Math.round(review.rating))}
            </p>
            <blockquote
              className="mt-3 text-sm leading-relaxed"
              style={{ color: PINE }}
            >
              &ldquo;{review.text}&rdquo;
            </blockquote>
            <figcaption className="mt-4 text-xs" style={{ color: SAGE }}>
              {review.author}
              {review.when ? ` · ${review.when}` : ""}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
