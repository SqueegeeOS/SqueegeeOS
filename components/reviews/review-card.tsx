import type { Review, ReviewsData } from "@/lib/reviews/types";

function formatReviewDate(isoDate: string, relativeDate?: string): string {
  if (relativeDate?.trim()) return relativeDate;
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function ReviewerAvatar({
  name,
  photoUrl,
  profileUrl,
}: {
  name: string;
  photoUrl?: string;
  profileUrl?: string;
}) {
  const avatar = photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photoUrl}
      alt=""
      referrerPolicy="no-referrer"
      className="h-10 w-10 rounded-full object-cover ring-1 ring-border"
    />
  ) : (
    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface font-serif text-sm text-muted">
      {name.trim().charAt(0).toUpperCase()}
    </div>
  );

  if (!profileUrl) return avatar;

  return (
    <a
      href={profileUrl}
      target="_blank"
      rel="noreferrer"
      aria-label={`Open ${name}'s Google Maps profile`}
    >
      {avatar}
    </a>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div
      className="flex justify-center gap-0.5"
      aria-label={`${rating} out of 5 stars`}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="currentColor"
          className={i < rating ? "text-accent/80" : "text-border"}
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

export function ReviewCard({
  review,
  provider,
  businessUrl,
}: {
  review: Review;
  provider?: ReviewsData["provider"];
  businessUrl?: string;
}) {
  const sourceUrl = review.reviewUrl ?? businessUrl;
  const sourceLabel = provider === "google_places" ? "Google Maps" : "Google";

  return (
    <blockquote className="text-center">
      <StarRating rating={review.rating} />
      {review.reviewText.trim() ? (
        <p className="mt-6 font-serif text-xl font-light leading-relaxed text-foreground sm:text-2xl sm:leading-relaxed">
          &ldquo;{review.reviewText}&rdquo;
        </p>
      ) : (
        <p className="mt-6 text-sm leading-relaxed text-muted">
          Rating-only review
        </p>
      )}
      <footer className="mt-8 flex flex-col items-center gap-3">
        <ReviewerAvatar
          name={review.reviewerName}
          photoUrl={review.profilePhotoUrl}
          profileUrl={review.reviewerProfileUrl}
        />
        <div>
          <p className="text-sm text-foreground/90">
            {review.reviewerProfileUrl ? (
              <a
                href={review.reviewerProfileUrl}
                target="_blank"
                rel="noreferrer"
                className="underline-offset-4 hover:underline"
              >
                {review.reviewerName}
              </a>
            ) : (
              review.reviewerName
            )}
          </p>
          <p className="mt-1 text-xs text-muted">
            {review.location ? `${review.location} · ` : ""}
            {formatReviewDate(review.reviewDate, review.relativeDate)} ·{" "}
            {sourceUrl ? (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noreferrer"
                translate="no"
                style={
                  provider === "google_places"
                    ? { color: "#5E5E5E" }
                    : undefined
                }
                className="whitespace-nowrap font-sans text-xs font-normal normal-case tracking-normal underline-offset-4 hover:underline"
              >
                {sourceLabel}
              </a>
            ) : (
              <span
                translate="no"
                style={
                  provider === "google_places"
                    ? { color: "#5E5E5E" }
                    : undefined
                }
                className="whitespace-nowrap font-sans text-xs font-normal normal-case tracking-normal"
              >
                {sourceLabel}
              </span>
            )}
          </p>
        </div>
      </footer>
    </blockquote>
  );
}

export function buildReviewsTitle(data: ReviewsData): string {
  if (data.isSampleData || data.totalCount === 0) {
    return "Approved Client Testimonials";
  }

  const rating =
    data.averageRating > 0 ? data.averageRating.toFixed(1) : null;

  if (rating) {
    return `${rating} Stars · ${data.totalCount} Google Reviews`;
  }

  return `${data.totalCount} Google Reviews`;
}

export function selectFeaturedReviews(
  data: ReviewsData,
  limit = 2,
): Review[] {
  return data.reviews.slice(0, limit);
}

export function SummaryStarRating({ rating }: { rating: number }) {
  if (rating <= 0) return null;

  return (
    <div
      className="mt-4 flex justify-center gap-1"
      aria-label={`${rating} out of 5 stars`}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="currentColor"
          className={i < Math.round(rating) ? "text-accent" : "text-border"}
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}
