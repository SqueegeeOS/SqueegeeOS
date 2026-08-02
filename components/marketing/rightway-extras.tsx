"use client";

import { useEffect, useRef, useState } from "react";
import { useNearViewport } from "@/components/reviews/use-near-viewport";
import type {
  GoogleReviewsApiResponse,
  Review,
  ReviewsData,
} from "@/lib/reviews/types";

const INK = "#07080c";
const GOLD = "#d4b98c";
const IVORY = "#f2efe7";
const MIST = "#8f9ab0";

/* ---- #3 Before / After: drag the blade ---------------------------- */
/* Swap images by replacing /rightway/before.jpg + /rightway/after.jpg  */
/* (currently stand-ins: the aligned night pair).                       */

export function BeforeAfter({
  before = "/night/house-dark.jpg",
  after = "/night/house-lit.jpg",
}: {
  before?: string;
  after?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0.5);
  const [ok, setOk] = useState(true);

  const move = (clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setP(Math.min(0.98, Math.max(0.02, (clientX - r.left) / r.width)));
  };

  if (!ok) return null;

  return (
    <section className="px-5 py-28 sm:px-12 sm:py-36" aria-label="Before and after">
      <h2 className="max-w-3xl font-serif text-5xl font-light leading-[0.95] sm:text-7xl" style={{ color: IVORY }}>
        Drag the blade.
        <br />
        <em className="night-shimmer-text">See the difference.</em>
      </h2>
      <div
        ref={ref}
        className="relative mt-14 aspect-[21/10] w-full cursor-ew-resize touch-none select-none overflow-hidden rounded-[1.5rem] border"
        style={{ borderColor: "rgba(242,239,231,0.12)" }}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          move(e.clientX);
        }}
        onPointerMove={(e) => e.buttons > 0 && move(e.clientX)}
        role="slider"
        aria-label="Before and after comparison"
        aria-valuenow={Math.round(p * 100)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setP((v) => Math.max(0.02, v - 0.05));
          if (e.key === "ArrowRight") setP((v) => Math.min(0.98, v + 0.05));
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={before} alt="Before our visit" className="absolute inset-0 h-full w-full object-cover" draggable={false} onError={() => setOk(false)} />
        <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - p * 100}% 0 0)` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={after} alt="After our visit" className="h-full w-full object-cover" draggable={false} />
        </div>
        <div aria-hidden className="absolute bottom-0 top-0 w-[3px]" style={{ left: `${p * 100}%`, background: GOLD, boxShadow: "0 0 18px rgba(212,185,140,0.7)" }}>
          <div className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full font-mono text-[10px]" style={{ background: GOLD, color: INK }}>
            ⇔
          </div>
        </div>
        <span aria-hidden className="absolute left-4 top-4 font-mono text-[10px] uppercase tracking-[0.25em]" style={{ color: `${IVORY}b3` }}>Before</span>
        <span aria-hidden className="absolute right-4 top-4 font-mono text-[10px] uppercase tracking-[0.25em]" style={{ color: GOLD }}>After</span>
      </div>
    </section>
  );
}

/* ---- #4 Living testimonial wall (real Google reviews only) -------- */

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

export function isDisplayableRightwayReview(review: Review): boolean {
  return (
    review.source === "Google" &&
    review.reviewerName.trim().length > 0 &&
    Number.isFinite(review.rating) &&
    review.rating >= 1 &&
    review.rating <= 5
  );
}

export function ReviewsWall() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [meta, setMeta] = useState<ReviewMeta>({});
  const { targetRef: reviewLoadRef, shouldLoad } = useNearViewport();

  useEffect(() => {
    if (!shouldLoad) return;
    const controller = new AbortController();

    fetch("/api/reviews/google", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: GoogleReviewsApiResponse | null) => {
        if (
          !payload?.data ||
          (payload.status !== "live" && payload.status !== "cached")
        ) {
          return;
        }

        const data = payload.data;
        if (data.provider === "google_places" && !data.businessUrl) return;

        const mapped = data.reviews
          .filter(isDisplayableRightwayReview)
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

  if (items.length === 0) {
    return <div ref={reviewLoadRef} aria-hidden className="min-h-px" />;
  }

  const placesPreview = meta.provider === "google_places";

  return (
    <section className="overflow-hidden border-y py-24 sm:py-28" style={{ borderColor: "rgba(242,239,231,0.1)" }} aria-label="Reviews">
      <div className="px-5 sm:px-12">
        <p className="font-sans text-xs font-normal normal-case tracking-normal" style={{ color: GOLD }}>
          {meta.rating ? `★ ${meta.rating.toFixed(1)} on ` : "Reviews on "}
          <span
            translate="no"
            style={placesPreview ? { color: "#ffffff" } : undefined}
            className="whitespace-nowrap font-sans text-xs font-normal normal-case tracking-normal"
          >
            {placesPreview ? "Google Maps" : "Google"}
          </span>
          {meta.count ? ` · ${meta.count} reviews` : ""}
        </p>
        {placesPreview && (
          <p className="mt-2 font-sans text-xs font-normal normal-case leading-relaxed tracking-normal" style={{ color: MIST }}>
            <a
              href={meta.businessUrl}
              target="_blank"
              rel="noreferrer"
              translate="no"
              style={{ color: "#ffffff" }}
              className="whitespace-nowrap font-sans text-xs font-normal normal-case tracking-normal underline-offset-4 hover:underline"
            >
              Google Maps
            </a>{" "}
            preview ordered by Google relevance; this site applies no rating
            filter.
          </p>
        )}
        <h2 className="mt-5 font-serif text-4xl font-light sm:text-6xl" style={{ color: IVORY }}>
          The neighbors talk.
        </h2>
      </div>
      <div className="night-marquee-slow mt-12 flex w-max gap-6 whitespace-normal">
        {[...items, ...items].map((review, index) => {
          const sourceUrl = review.reviewUrl ?? meta.businessUrl;
          return (
            <figure key={`${review.id}-${index}`} className="w-80 flex-none rounded-[1.25rem] border p-6" style={{ borderColor: "rgba(242,239,231,0.1)", background: "#0d0f16" }}>
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
                <p aria-label={`${review.rating} out of 5 stars`} className="font-mono text-xs tracking-[0.2em]" style={{ color: GOLD }}>
                  <span aria-hidden>{"★".repeat(Math.round(review.rating))}</span>
                </p>
              </div>
              {review.text.trim() ? (
                <blockquote className="mt-3 text-sm leading-relaxed" style={{ color: `${IVORY}d9` }}>&ldquo;{review.text}&rdquo;</blockquote>
              ) : (
                <p className="mt-3 text-sm leading-relaxed" style={{ color: MIST }}>
                  Rating-only review
                </p>
              )}
              <figcaption className="mt-4 text-xs" style={{ color: MIST }}>
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
                {review.when ? ` · ${review.when}` : ""}
                {sourceUrl && (
                  <>
                    {" · "}
                    <a
                      href={sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      translate="no"
                      style={
                        placesPreview ? { color: "#ffffff" } : undefined
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

/* ---- #5 Sound: unmute the films' own generated audio -------------- */

export function SoundToggle() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    document.querySelectorAll("video").forEach((v) => {
      v.muted = !on;
      if (on && v.paused && v.closest("section")) void v.play().catch(() => {});
    });
  }, [on]);
  return (
    <button
      type="button"
      onClick={() => setOn(!on)}
      aria-pressed={on}
      aria-label={on ? "Mute the films" : "Hear the films"}
      className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full border backdrop-blur-sm transition-colors"
      style={{ borderColor: on ? GOLD : "rgba(242,239,231,0.2)", background: "rgba(7,8,12,0.7)", color: on ? GOLD : MIST }}
    >
      {on ? "♪" : "∅"}
    </button>
  );
}
