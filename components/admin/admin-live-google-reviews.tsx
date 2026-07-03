"use client";

import Link from "next/link";
import { useGoogleReviewsClient } from "@/lib/reviews/use-google-reviews-client";
import { buildReviewsTitle } from "@/components/reviews/review-card";
import { ROUTES } from "@/lib/navigation/config";

export function AdminLiveGoogleReviews() {
  const { response, loading } = useGoogleReviewsClient();

  if (loading) {
    return (
      <article className="rounded-[1.75rem] border border-border/60 bg-background/30 px-6 py-5 sm:px-7">
        <p className="text-[10px] uppercase tracking-[0.28em] text-muted">
          Google Reviews
        </p>
        <p className="mt-3 font-serif text-2xl font-light text-muted">
          Loading live rating…
        </p>
      </article>
    );
  }

  const data = response?.data;
  const isLive =
    response?.status === "live" && data && !data.isSampleData && data.totalCount > 0;

  return (
    <article className="rounded-[1.75rem] border border-border/60 bg-background/30 px-6 py-5 sm:px-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.28em] text-muted">
          Google Reviews
        </p>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-[9px] uppercase tracking-[0.16em] ${
            isLive
              ? "border-accent/30 text-accent"
              : "border-border text-muted/70"
          }`}
        >
          {isLive ? "Live" : response?.status ?? "unavailable"}
        </span>
      </div>

      {isLive && data ? (
        <>
          <p className="mt-3 font-serif text-3xl font-light text-foreground">
            {buildReviewsTitle(data)}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Pulled from Google Places — same source as the website and Home Care
            Plans. Cached up to 8 hours.
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
    </article>
  );
}
